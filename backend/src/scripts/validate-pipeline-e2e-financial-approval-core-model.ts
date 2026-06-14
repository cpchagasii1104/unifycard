/**
 * E2E — F-CORE-FINANCIAL-APPROVAL-MODEL (DECISION-0128).
 *
 * Prova que o Core de Aprovação Financeira (service NÃO-EXECUTOR sobre as tabelas canônicas
 * approval_requests / approval_votes) registra request/decision/governança SEM mover dinheiro.
 *
 *   T1  createFinancialApprovalRequest → 'pending', sem tocar Bank.
 *   T2  recordFinancialApprovalDecision(approve, required=1) → outcome 'approved', executed:false, sem Bank.
 *   T3  voto reject → outcome 'rejected'.
 *   T4  cancel pending → 'cancelled'.
 *   T5  amount_cents (operation_data) round-trip íntegro; frente NÃO criou coluna money não-BIGINT.
 *   T6  isolamento de tenant: request do tenant A não aparece sob tenant B.
 *   T7  subject server-side: requested_by_user_id = user server-side; service recusa subject ausente.
 *   T8  idempotency_key: duas criações com mesma chave → uma única request.
 *   T9  decisão append-only: UPDATE em approval_votes levanta; 2º voto do mesmo user → duplicata.
 *   T10 delete proibido: DELETE em approval_requests/approval_votes levanta (trigger).
 *   T11 bank_ledger count before == after.
 *   T12 bank_transactions count before == after.
 *   T13 actor_wallet_payout_requests count before == after (payout intocado).
 *   T14 DECISION-0113 baseline permanece 2.
 *   T15 nenhuma coluna can_execute_* em company_users / tenant_operator_grants.
 *   T16 estado terminal congelado: UPDATE status de approved→pending levanta; service recusa decisão em terminal.
 *   S1  estrutural: Core não contém executor financeiro / bank writer (guard verde).
 *
 * 🔒 DB EFÊMERA (wrapper run-financial-approval-core-ephemeral.ps1). Zero Bank; nenhum dinheiro movido.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
dotenv.config({ path: join(process.cwd(), '.env') });

import { pool } from '../core/database/pool';
import {
  createFinancialApprovalRequest,
  recordFinancialApprovalDecision,
  cancelFinancialApprovalRequest,
  getFinancialApprovalRequest,
  listFinancialApprovalRequests,
  FinancialApprovalError,
} from '../core/financial-approval/financial-approval.service';
import { ApprovalVoteDuplicateError } from '../core/financial-approval/financial-approval.repository';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/approval|financial|core|test|ephemeral/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const count = async (sql: string, p: unknown[] = []): Promise<number> =>
  Number((await pool.query<{ n: string }>(sql, p)).rows[0].n);
const tableExists = async (t: string): Promise<boolean> =>
  (await count(`SELECT count(*)::text n FROM information_schema.tables WHERE table_name=$1`, [t])) === 1;

interface Fixture { tenantId: string; userId: string; actorId: string; accountId: string; }

// Seed da cadeia mínima de identidade→actor→conta (DB efêmera vazia).
async function seedFixture(seed: number): Promise<Fixture> {
  const tenantId = randomUUID();
  const globalUserId = randomUUID();
  const userId = randomUUID();
  const actorId = randomUUID();
  const cpf = String(10000000000 + (seed % 89999999999));
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3)`,
    [tenantId, `e2e-approval-${seed}`, `e2e-approval-${seed}`]);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1,$2)`, [globalUserId, cpf]);
  await pool.query(
    `INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level)
     VALUES ($1,$2,'cpf','approved','complete')`, [globalUserId, cpf]);
  await pool.query(
    `INSERT INTO users (id, user_id, tenant_id, email, password_hash, global_user_id)
     VALUES ($1,$1,$2,$3,'x',$4)`, [userId, tenantId, `e2e-approval-${seed}@e2e.local`, globalUserId]);
  await pool.query(
    `INSERT INTO actors (id, actor_id, tenant_id, actor_type, display_name, user_id, global_user_id)
     VALUES ($1,$1,$2,'user','E2E Approval User',$3,$4)`, [actorId, tenantId, userId, globalUserId]);
  const acc = await pool.query<{ id: string }>(
    `INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, actor_id, account_type)
     VALUES ($1,'actor',$2,$3,'actor_wallet') RETURNING id`, [tenantId, actorId, actorId]);
  return { tenantId, userId, actorId, accountId: acc.rows[0].id };
}

const futureExpiry = (): Date => new Date(Date.now() + 60 * 60 * 1000);

async function main(): Promise<void> {
  await assertEphemeralDb();
  const base = Math.floor(Math.random() * 90000000) + 10000000;
  const A = await seedFixture(base);
  const B = await seedFixture(base + 1);

  const lExists = await tableExists('bank_ledger');
  const txExists = await tableExists('bank_transactions');
  const poExists = await tableExists('actor_wallet_payout_requests');
  const ledgerBefore = lExists ? await count(`SELECT count(*)::text n FROM bank_ledger`) : 0;
  const txBefore = txExists ? await count(`SELECT count(*)::text n FROM bank_transactions`) : 0;
  const poBefore = poExists ? await count(`SELECT count(*)::text n FROM actor_wallet_payout_requests`) : 0;

  try {
    // T1 — create request (pending), sem Bank.
    const req1 = await createFinancialApprovalRequest({
      tenantId: A.tenantId, requestedByUserId: A.userId, actingForActorId: A.actorId,
      actingForAccountId: A.accountId, operationType: 'actor_wallet_payout',
      operationData: { amount_cents: 150000, note: 'e2e' }, expiresAt: futureExpiry(),
    });
    record('T1 createFinancialApprovalRequest → pending', req1.status === 'pending', `status=${req1.status}`);

    // T2 — approve (required=1) → approved, executed:false, sem Bank.
    const dec = await recordFinancialApprovalDecision({
      tenantId: A.tenantId, approvalRequestId: req1.id, votedByUserId: A.userId, voteType: 'approve',
    });
    record('T2 decisão approve → outcome=approved, executed=false',
      dec.outcome === 'approved' && dec.executed === false && dec.request.status === 'approved',
      `outcome=${dec.outcome} executed=${dec.executed}`);

    // T3 — reject em nova request → rejected.
    const req3 = await createFinancialApprovalRequest({
      tenantId: A.tenantId, requestedByUserId: A.userId, actingForActorId: A.actorId,
      actingForAccountId: A.accountId, operationType: 'transfer', operationData: {}, expiresAt: futureExpiry(),
    });
    const dec3 = await recordFinancialApprovalDecision({
      tenantId: A.tenantId, approvalRequestId: req3.id, votedByUserId: A.userId, voteType: 'reject',
    });
    record('T3 decisão reject → outcome=rejected', dec3.outcome === 'rejected' && dec3.request.status === 'rejected', `outcome=${dec3.outcome}`);

    // T4 — cancel pending → cancelled.
    const req4 = await createFinancialApprovalRequest({
      tenantId: A.tenantId, requestedByUserId: A.userId, actingForActorId: A.actorId,
      actingForAccountId: A.accountId, operationType: 'payment', operationData: {}, expiresAt: futureExpiry(),
    });
    const cancelled = await cancelFinancialApprovalRequest(A.tenantId, req4.id);
    record('T4 cancel pending → cancelled', cancelled.status === 'cancelled', `status=${cancelled.status}`);

    // T5 — amount round-trip + nenhuma coluna money não-BIGINT criada pela frente.
    const view = await getFinancialApprovalRequest(A.tenantId, req1.id);
    const amt = (view.request.operation_data as Record<string, unknown>).amount_cents;
    const moneyColsNonBigint = await count(
      `SELECT count(*)::text n FROM information_schema.columns
        WHERE table_name IN ('approval_requests','approval_votes')
          AND column_name LIKE '%amount%cents%' AND data_type <> 'bigint'`);
    record('T5 amount_cents round-trip íntegro + zero coluna money não-BIGINT na frente',
      amt === 150000 && moneyColsNonBigint === 0, `amt=${amt} nonBigintMoneyCols=${moneyColsNonBigint}`);

    // T6 — isolamento de tenant.
    const listA = await listFinancialApprovalRequests(A.tenantId, {});
    const listB = await listFinancialApprovalRequests(B.tenantId, {});
    record('T6 isolamento de tenant: request do tenant A não aparece sob tenant B',
      listA.some((r) => r.id === req1.id) && !listB.some((r) => r.id === req1.id),
      `A=${listA.length} B=${listB.length}`);

    // T7 — subject server-side; service recusa subject ausente.
    let subjectGuard = false;
    try {
      await createFinancialApprovalRequest({
        tenantId: A.tenantId, requestedByUserId: '', actingForActorId: A.actorId,
        actingForAccountId: A.accountId, operationType: 'transfer', operationData: {}, expiresAt: futureExpiry(),
      });
    } catch (e) {
      subjectGuard = e instanceof FinancialApprovalError && e.code === 'MISSING_SERVER_SIDE_SUBJECT';
    }
    record('T7 subject server-side (requested_by_user_id=user; recusa subject ausente)',
      req1.requested_by_user_id === A.userId && subjectGuard, `subj=${req1.requested_by_user_id === A.userId} guard=${subjectGuard}`);

    // T8 — idempotency_key dedup.
    const key = `idem-${base}`;
    const i1 = await createFinancialApprovalRequest({
      tenantId: A.tenantId, requestedByUserId: A.userId, actingForActorId: A.actorId,
      actingForAccountId: A.accountId, operationType: 'transfer', operationData: {}, expiresAt: futureExpiry(), idempotencyKey: key,
    });
    const i2 = await createFinancialApprovalRequest({
      tenantId: A.tenantId, requestedByUserId: A.userId, actingForActorId: A.actorId,
      actingForAccountId: A.accountId, operationType: 'transfer', operationData: {}, expiresAt: futureExpiry(), idempotencyKey: key,
    });
    const idemRows = await count(`SELECT count(*)::text n FROM approval_requests WHERE tenant_id=$1 AND idempotency_key=$2`, [A.tenantId, key]);
    record('T8 idempotency_key: duas criações = uma request', i1.id === i2.id && idemRows === 1, `same=${i1.id === i2.id} rows=${idemRows}`);

    // T9 — decisão append-only.
    let voteUpdateBlocked = false, dupVoteBlocked = false;
    try { await pool.query(`UPDATE approval_votes SET vote_type='reject' WHERE approval_request_id=$1`, [req1.id]); }
    catch { voteUpdateBlocked = true; }
    try {
      await recordFinancialApprovalDecision({ tenantId: A.tenantId, approvalRequestId: i1.id, votedByUserId: A.userId, voteType: 'approve' });
      await recordFinancialApprovalDecision({ tenantId: A.tenantId, approvalRequestId: i1.id, votedByUserId: A.userId, voteType: 'reject' });
    } catch (e) { dupVoteBlocked = e instanceof ApprovalVoteDuplicateError || (e instanceof FinancialApprovalError); }
    record('T9 decisão append-only (UPDATE voto bloqueado; 2º voto mesmo user bloqueado)', voteUpdateBlocked && dupVoteBlocked, `update=${voteUpdateBlocked} dup=${dupVoteBlocked}`);

    // T10 — delete proibido.
    let reqDelBlocked = false, voteDelBlocked = false;
    try { await pool.query(`DELETE FROM approval_requests WHERE id=$1`, [req1.id]); } catch { reqDelBlocked = true; }
    try { await pool.query(`DELETE FROM approval_votes WHERE approval_request_id=$1`, [req1.id]); } catch { voteDelBlocked = true; }
    record('T10 delete proibido em approval_requests e approval_votes', reqDelBlocked && voteDelBlocked, `req=${reqDelBlocked} vote=${voteDelBlocked}`);

    // T11/T12/T13 — Bank/payout intocados.
    const ledgerAfter = lExists ? await count(`SELECT count(*)::text n FROM bank_ledger`) : 0;
    const txAfter = txExists ? await count(`SELECT count(*)::text n FROM bank_transactions`) : 0;
    const poAfter = poExists ? await count(`SELECT count(*)::text n FROM actor_wallet_payout_requests`) : 0;
    record('T11 bank_ledger count before==after', ledgerAfter === ledgerBefore, `${ledgerBefore}->${ledgerAfter}`);
    record('T12 bank_transactions count before==after', txAfter === txBefore, `${txBefore}->${txAfter}`);
    record('T13 actor_wallet_payout_requests count before==after', poAfter === poBefore, `${poBefore}->${poAfter}`);

    // T14 — DECISION-0113 baseline permanece 2.
    let baseline2 = false;
    try {
      const out = execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd: join(process.cwd()), encoding: 'utf8' });
      baseline2 = /baseline=2\b/.test(out) && /new=0\b/.test(out);
    } catch (e) { baseline2 = false; }
    record('T14 DECISION-0113 baseline permanece 2 (new=0)', baseline2);

    // T15 — nenhuma coluna can_execute_* em grants comuns.
    const canExec = await count(
      `SELECT count(*)::text n FROM information_schema.columns
        WHERE table_name IN ('company_users','tenant_operator_grants') AND column_name LIKE 'can_execute_%'`);
    record('T15 zero coluna can_execute_* em company_users/tenant_operator_grants', canExec === 0, `cols=${canExec}`);

    // T16 — estado terminal congelado.
    let terminalFrozenDb = false, serviceRejectsTerminal = false;
    try { await pool.query(`UPDATE approval_requests SET status='pending' WHERE id=$1`, [req1.id]); }
    catch { terminalFrozenDb = true; }
    try { await recordFinancialApprovalDecision({ tenantId: A.tenantId, approvalRequestId: req1.id, votedByUserId: B.userId, voteType: 'approve' }); }
    catch (e) { serviceRejectsTerminal = e instanceof FinancialApprovalError && e.code.startsWith('APPROVAL_REQUEST_NOT_PENDING'); }
    record('T16 estado terminal congelado (UPDATE approved→pending bloqueado; service recusa decisão em terminal)',
      terminalFrozenDb && serviceRejectsTerminal, `db=${terminalFrozenDb} svc=${serviceRejectsTerminal}`);

    // S1 — estrutural: Core sem executor financeiro / bank writer.
    let coreClean = false;
    try { execSync('node scripts/audit-financial-approval-core-boundary.mjs', { cwd: process.cwd(), encoding: 'utf8' }); coreClean = true; }
    catch { coreClean = false; }
    record('S1 Core não-executor (guard financial-approval-core verde)', coreClean);
  } finally {
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    process.exit(1);
  }
  console.log('✨ Core de Aprovação Financeira NÃO-EXECUTOR: registra request/decision/governança; zero dinheiro movido — verde.');
  process.exit(0);
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
