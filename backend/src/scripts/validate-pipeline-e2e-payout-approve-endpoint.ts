/**
 * E2E — F-PAYOUT-APPROVE-ENDPOINT-CORE-AUTHORITY / CAMINHO B (DECISION-0129). NÃO MOVE DINHEIRO.
 *
 * Prova o endpoint de decisão FAIL-CLOSED: POST /api/payouts/requests/:id/decision resolve o
 * payout_request + approval_request, valida tenant/tipo/estado, exige requester != approver (D3) e
 * então retorna PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED (política/faixa material ausente — D2/D4/D6).
 * NUNCA aprova, NUNCA executa, NUNCA chama approveActorWalletPayout/recordFinancialApprovalDecision/
 * worker/Bank. Approval permanece 'pending'; payout permanece 'pending_approval'; executed:false.
 *
 *   T1  decision approve → 422 PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED, executed:false.
 *   T2  approval permanece pending.   T3 payout permanece pending_approval.   T4 executed:false.
 *   T5/T6/T7 bank_ledger/bank_transactions/bank_splits intocados.
 *   T8  approveActorWalletPayout NÃO chamado (sem approved_amount_cents / settlement / status approved).
 *   T9  recordFinancialApprovalDecision NÃO registra approve (zero approval_votes).
 *   T10 requester == approver → 403 PAYOUT_APPROVER_CANNOT_BE_REQUESTER.
 *   T11 spoof body (approvedByUserId/tenantId/status/operationType/approvalRequestId/availableBalanceCents) IGNORADO.
 *   T12 wrong tenant → 404 (não resolve fora do tenant).
 *   T13 wrong operation_type → 422 PAYOUT_APPROVAL_WRONG_TYPE.
 *   T14 company_users/tenant_operator_grants/businessAuthorizationService NÃO aparecem na rota (não aprovam).
 *   T15 availableBalanceCents não autoriza (saldo>0 e ainda assim NOT_CONFIGURED).
 *   T16 seller_available não lido (guard verde).   T17 payout_requests legado não usado (guard verde).
 *   T18 rotas antigas (batches/execute-manual/fail) continuam 403.
 *   T19 worker default-off.   T20 bank-http request-only.   T21 baseline 0113=0.
 *   T22 can_execute_* comum não criado.   T23 request-only entrypoint intacto + payout segue pending.
 *   T24 nenhum approved real nasce (zero payout/approval 'approved').   T25 nenhum ledger nasce.
 *
 * 🔒 DB EFÊMERA (wrapper run-payout-approve-endpoint-ephemeral.ps1).
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
dotenv.config({ path: join(process.cwd(), '.env') });

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { pool } from '../core/database/pool';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (l: string, ok: boolean, r?: string): void => { results.push({ label: l, ok, reason: r }); console.log(`  ${ok ? '✅' : '❌'} ${l}${ok ? '' : ` — ${r ?? ''}`}`); };
const q = (sql: string, p: unknown[] = []) => pool.query(sql, p);
const cwd = process.cwd();
const guardGreen = (s: string): boolean => { try { execSync(`node scripts/${s}`, { cwd, encoding: 'utf8' }); return true; } catch { return false; } };

let TENANT = ''; let OTHER_TENANT = ''; let REQUESTER = ''; let APPROVER = '';
let ACTOR = ''; let CONCEPT = '';
let PAYOUT1 = ''; let APPROVAL1 = '';
let PAYOUT2 = ''; let APPROVAL2 = '';
// Auth stub mutável (preHandler lê por request).
let CURRENT_USER = ''; let CURRENT_TENANT = '';

async function assertEphemeral(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: alvo é unificard_dev.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/payout|approve|decision|test|ephemeral/i.test(db)) throw new Error(`ABORT: "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  const payoutModule = (await import('../modules/payout/payout.module')).default;
  await app.register(async (scope) => {
    scope.decorateRequest('user', null);
    scope.decorateRequest('tenant', null);
    scope.addHook('preHandler', async (req) => {
      (req as any).user = { id: CURRENT_USER, userId: CURRENT_USER, tenantId: CURRENT_TENANT };
      (req as any).tenant = { id: CURRENT_TENANT };
    });
    await scope.register(payoutModule);
  });
  await app.ready();
  return app;
}

async function makeWallet(actorId: string): Promise<string> {
  await q(`INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, actor_id, account_type) VALUES ($1,'actor',$2,$3,'actor_wallet')`, [TENANT, `${actorId}:actor_wallet`, actorId]);
  return (await q(`SELECT id FROM bank_accounts WHERE tenant_id=$1 AND actor_id=$2 AND account_type='actor_wallet' LIMIT 1`, [TENANT, actorId])).rows[0].id;
}

async function seed(base: number): Promise<void> {
  TENANT = uuidv4(); OTHER_TENANT = uuidv4();
  const gidR = uuidv4(); REQUESTER = uuidv4();
  const gidA = uuidv4(); APPROVER = uuidv4();
  ACTOR = uuidv4();
  const cpfR = String(10000000000 + (base % 79999999999));
  const cpfA = String(20000000000 + (base % 69999999999));
  await q(`INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3)`, [TENANT, `e2e-pdec-${base}`, `e2e-pdec-${base}`]);
  // requester
  await q(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1,$2)`, [gidR, cpfR]);
  await q(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','complete')`, [gidR, cpfR]);
  await q(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, global_user_id) VALUES ($1,$1,$2,$3,'x',$4)`, [REQUESTER, TENANT, `req-${base}@e2e.local`, gidR]);
  await q(`INSERT INTO actors (id, actor_id, tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1,$1,$2,'user','E2E Requester',$3,$4)`, [ACTOR, TENANT, REQUESTER, gidR]);
  // approver (usuário institucional distinto; sem actor próprio necessário)
  await q(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1,$2)`, [gidA, cpfA]);
  await q(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','complete')`, [gidA, cpfA]);
  await q(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, global_user_id) VALUES ($1,$1,$2,$3,'x',$4)`, [APPROVER, TENANT, `appr-${base}@e2e.local`, gidA]);

  const wacc = await makeWallet(ACTOR);
  CONCEPT = (await q(`SELECT concept_id FROM concepts LIMIT 1`)).rows[0]?.concept_id;
  if (!CONCEPT) throw new Error('Sem concept.');
  // coverage (conta system clearing creditada) + crédito da wallet p/ saldo > 0 (prova T15).
  const clearing = await q(`INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, account_type) VALUES ($1,'system',$2,'clearing') RETURNING id`, [TENANT, `system:clearing:${TENANT}`]);
  const ct = uuidv4();
  await q(`INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification, reference_type, reference_id, concept_id) VALUES ($1,$2,$3,$4,$5,'initial_credit','e2e pdec coverage seed','e2e_pdec_cov',$6,$7)`, [ct, TENANT, ACTOR, clearing.rows[0].id, 100000000, ct, CONCEPT]);
  await q(`INSERT INTO bank_ledger (id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification) VALUES (gen_random_uuid(),$1,$2,$3,'credit',$4,'initial_credit','e2e pdec coverage seed')`, [TENANT, clearing.rows[0].id, ct, 100000000]);
  const wt = uuidv4();
  await q(`INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification, reference_type, reference_id, concept_id) VALUES ($1,$2,$3,$4,$5,'initial_credit','e2e pdec wallet seed','e2e_pdec_seed',$6,$7)`, [wt, TENANT, ACTOR, wacc, 10000, wt, CONCEPT]);
  await q(`INSERT INTO bank_ledger (id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification) VALUES (gen_random_uuid(),$1,$2,$3,'credit',$4,'initial_credit','e2e pdec wallet seed')`, [TENANT, wacc, wt, 10000]);

  // PAYOUT1 + APPROVAL1 (pending; operation_type=actor_wallet_payout) via service (requested_by=REQUESTER).
  const { actorWalletPayoutService } = await import('../modules/wallet/actor-wallet-payout.service');
  const r = await actorWalletPayoutService.requestActorWalletPayout({
    tenantId: TENANT, actorId: ACTOR, requestedByUserId: REQUESTER,
    requestedAmountCents: 1000, idempotencyKey: `pdec-${base}`, reason: 'e2e decision fixture',
  });
  PAYOUT1 = r.payoutRequest.id; APPROVAL1 = r.payoutRequest.approvalRequestId!;

  // PAYOUT2 + APPROVAL2 (wrong operation_type='transfer') — ator distinto p/ não colidir active-gate.
  const gidX = uuidv4(); const userX = uuidv4(); const ACTOR2 = uuidv4(); const cpfX = String(30000000000 + (base % 59999999999));
  await q(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1,$2)`, [gidX, cpfX]);
  await q(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','complete')`, [gidX, cpfX]);
  await q(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, global_user_id) VALUES ($1,$1,$2,$3,'x',$4)`, [userX, TENANT, `x-${base}@e2e.local`, gidX]);
  await q(`INSERT INTO actors (id, actor_id, tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1,$1,$2,'user','E2E WrongType',$3,$4)`, [ACTOR2, TENANT, userX, gidX]);
  const wacc2 = await makeWallet(ACTOR2);
  APPROVAL2 = uuidv4();
  await q(`INSERT INTO approval_requests (id, tenant_id, requested_by_user_id, acting_for_actor_id, acting_for_account_id, operation_type, operation_data, required_approvals, approval_type, status, idempotency_key, expires_at) VALUES ($1,$2,$3,$4,$5,'transfer','{}'::jsonb,1,'sequential','pending',$6, NOW() + INTERVAL '7 days')`, [APPROVAL2, TENANT, REQUESTER, ACTOR2, wacc2, `pdec-wt-${base}`]);
  PAYOUT2 = uuidv4();
  await q(`INSERT INTO actor_wallet_payout_requests (id, tenant_id, actor_id, actor_wallet_account_id, approval_request_id, requested_amount_cents, destination_type, idempotency_key, status) VALUES ($1,$2,$3,$4,$5,$6,'internal_settlement',$7,'pending_approval')`, [PAYOUT2, TENANT, ACTOR2, wacc2, APPROVAL2, 1000, `pdec-wt-${base}`]);
}

const snap = async (t: string): Promise<number> => Number((await q(`SELECT count(*)::int n FROM ${t} WHERE tenant_id=$1`, [TENANT])).rows[0].n);
const votesCount = async (apprId: string): Promise<number> => Number((await q(`SELECT count(*)::int n FROM approval_votes WHERE approval_request_id=$1`, [apprId])).rows[0].n);
const apprStatus = async (id: string): Promise<string> => (await q(`SELECT status FROM approval_requests WHERE id=$1`, [id])).rows[0]?.status;
const payoutRow = async (id: string) => (await q(`SELECT status, approved_amount_cents, executed_amount_cents, settlement_transaction_id FROM actor_wallet_payout_requests WHERE id=$1`, [id])).rows[0];

async function main(): Promise<void> {
  await assertEphemeral();
  const base = Math.floor(Math.random() * 90000000) + 10000000;
  await seed(base);
  CURRENT_USER = APPROVER; CURRENT_TENANT = TENANT;
  const app = await buildApp();
  const hdr = { 'content-type': 'application/json' };
  const decide = (id: string, payload: object) => app.inject({ method: 'POST', url: `/api/payouts/requests/${id}/decision`, headers: hdr, payload: JSON.stringify(payload) });

  const lB = await snap('bank_ledger'); const txB = await snap('bank_transactions'); const spB = await snap('bank_splits');

  try {
    // T1/T4 — approve → 422 POLICY_NOT_CONFIGURED, executed:false.
    const r1 = await decide(PAYOUT1, { decision: 'approve', reason: 'tentativa de aprovação' });
    const b1 = (() => { try { return JSON.parse(r1.body); } catch { return null; } })();
    record('T1 decision approve → 422 PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED, executed:false',
      r1.statusCode === 422 && b1?.code === 'PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED' && b1?.executed === false,
      `status=${r1.statusCode} body=${r1.body.slice(0, 160)}`);

    // T2 — approval pending.
    record('T2 approval permanece pending', (await apprStatus(APPROVAL1)) === 'pending', `status=${await apprStatus(APPROVAL1)}`);
    // T3 — payout pending_approval.
    const p3 = await payoutRow(PAYOUT1);
    record('T3 payout permanece pending_approval', p3.status === 'pending_approval', `status=${p3.status}`);
    // T4 — executed:false + status no body.
    record('T4 executed:false + approvalStatus pending + payoutStatus pending_approval no body',
      b1?.executed === false && b1?.approvalStatus === 'pending' && b1?.payoutStatus === 'pending_approval');

    // T5/T6/T7 — Bank intocado.
    record('T5 bank_ledger intocado', (await snap('bank_ledger')) === lB);
    record('T6 bank_transactions intocado', (await snap('bank_transactions')) === txB);
    record('T7 bank_splits intocado', (await snap('bank_splits')) === spB);

    // T8 — approveActorWalletPayout não chamado.
    record('T8 approveActorWalletPayout NÃO chamado (sem approved/settlement/approved_amount)',
      p3.status === 'pending_approval' && p3.approved_amount_cents === null && p3.executed_amount_cents === null && p3.settlement_transaction_id === null,
      JSON.stringify(p3));
    // T9 — recordFinancialApprovalDecision não registra approve.
    record('T9 recordFinancialApprovalDecision NÃO registra approve (zero approval_votes)', (await votesCount(APPROVAL1)) === 0, `votes=${await votesCount(APPROVAL1)}`);

    // T10 — requester == approver → 403.
    CURRENT_USER = REQUESTER;
    const r10 = await decide(PAYOUT1, { decision: 'approve' });
    const b10 = (() => { try { return JSON.parse(r10.body); } catch { return null; } })();
    CURRENT_USER = APPROVER;
    record('T10 requester == approver → 403 PAYOUT_APPROVER_CANNOT_BE_REQUESTER',
      r10.statusCode === 403 && b10?.code === 'PAYOUT_APPROVER_CANNOT_BE_REQUESTER' && b10?.executed === false && (await apprStatus(APPROVAL1)) === 'pending',
      `status=${r10.statusCode} code=${b10?.code}`);

    // T11 — spoof body ignorado (subject=req.user=APPROVER; ainda fail-closed).
    const r11 = await decide(PAYOUT1, { decision: 'approve', approvedByUserId: REQUESTER, tenantId: OTHER_TENANT, status: 'approved', operationType: 'transfer', approvalRequestId: uuidv4(), availableBalanceCents: 999999999 });
    const b11 = (() => { try { return JSON.parse(r11.body); } catch { return null; } })();
    record('T11 spoof body (approvedByUserId/tenantId/status/operationType/approvalRequestId/availableBalanceCents) IGNORADO',
      r11.statusCode === 422 && b11?.code === 'PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED' && (await apprStatus(APPROVAL1)) === 'pending' && (await votesCount(APPROVAL1)) === 0,
      `status=${r11.statusCode} code=${b11?.code}`);

    // T12 — wrong tenant → 404.
    CURRENT_TENANT = OTHER_TENANT;
    const r12 = await decide(PAYOUT1, { decision: 'approve' });
    const b12 = (() => { try { return JSON.parse(r12.body); } catch { return null; } })();
    CURRENT_TENANT = TENANT;
    record('T12 wrong tenant → 404 PAYOUT_REQUEST_NOT_FOUND (não resolve fora do tenant)',
      r12.statusCode === 404 && b12?.code === 'PAYOUT_REQUEST_NOT_FOUND', `status=${r12.statusCode} code=${b12?.code}`);

    // T13 — wrong operation_type → 422.
    const r13 = await decide(PAYOUT2, { decision: 'approve' });
    const b13 = (() => { try { return JSON.parse(r13.body); } catch { return null; } })();
    record('T13 wrong operation_type → 422 PAYOUT_APPROVAL_WRONG_TYPE',
      r13.statusCode === 422 && b13?.code === 'PAYOUT_APPROVAL_WRONG_TYPE' && b13?.executed === false, `status=${r13.statusCode} code=${b13?.code}`);

    // T14 — autoridade comum NÃO aparece na rota (não aprova).
    const routeSrc = readFileSync(join(cwd, 'src/modules/payout/payout-decision.routes.ts'), 'utf8')
      .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
    const noCommonAuth = !/company_users|tenant_operator_grants|businessAuthorizationService|organization_members/.test(routeSrc);
    record('T14 company_users/tenant_operator_grants/businessAuthorizationService NÃO aprovam (ausentes na rota)', noCommonAuth);

    // T15 — availableBalanceCents não autoriza (saldo>0 e ainda NOT_CONFIGURED).
    const bal = Number((await q(`SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END),0)::bigint b FROM bank_ledger WHERE tenant_id=$1 AND account_id=(SELECT id FROM bank_accounts WHERE tenant_id=$1 AND actor_id=$2 AND account_type='actor_wallet' LIMIT 1)`, [TENANT, ACTOR])).rows[0].b);
    record('T15 availableBalanceCents não autoriza (saldo>0 e ainda assim NOT_CONFIGURED)', bal > 0 && b1?.code === 'PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED', `bal=${bal}`);

    // T16/T17 — seller_available/payout_requests legado não usados (guard verde + ausência no fonte).
    record('T16 seller_available não lido (guard verde + ausente na rota)', guardGreen('audit-payout-approve-endpoint.mjs') && !/seller_available|seller_payout/.test(routeSrc));
    record('T17 payout_requests legado não usado (ausente na rota)', !/\bpayout_requests\b/.test(routeSrc));

    // T18 — rotas antigas 403.
    const rb = await app.inject({ method: 'POST', url: '/api/payouts/batches', headers: hdr, payload: '{}' });
    const rem = await app.inject({ method: 'POST', url: `/api/payouts/orders/${uuidv4()}/execute-manual`, headers: hdr, payload: '{}' });
    const rf = await app.inject({ method: 'POST', url: `/api/payouts/orders/${uuidv4()}/fail`, headers: hdr, payload: '{}' });
    record('T18 rotas antigas (batches/execute-manual/fail) continuam 403', rb.statusCode === 403 && rem.statusCode === 403 && rf.statusCode === 403, `${rb.statusCode}/${rem.statusCode}/${rf.statusCode}`);

    // T19/T20 — worker default-off + bank-http request-only.
    record('T19 worker default-off (dormancy guard verde)', guardGreen('audit-financial-workers-dormancy.mjs'));
    record('T20 bank-http request-only (guard verde)', guardGreen('audit-bank-http-authority-binding.mjs'));

    // T21 — baseline 0113=0.
    let baseline0 = false;
    try { baseline0 = /baseline=0\b/.test(execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' })); } catch { baseline0 = false; }
    record('T21 DECISION-0113 baseline=0', baseline0);

    // T22 — can_execute_* comum não criado.
    const canExec = (await q(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name IN ('company_users','tenant_operator_grants') AND column_name LIKE 'can_execute_%'`)).rows[0].n;
    record('T22 can_execute_* comum não criado', canExec === 0, `canExec=${canExec}`);

    // T23 — request-only entrypoint intacto + payout segue pending.
    record('T23 request-only entrypoint intacto + payout segue pending_approval', guardGreen('audit-payout-request-only-entrypoint.mjs') && (await payoutRow(PAYOUT1)).status === 'pending_approval');

    // T24 — nenhum approved real nasce.
    const apprApproved = Number((await q(`SELECT count(*)::int n FROM approval_requests WHERE tenant_id=$1 AND status='approved'`, [TENANT])).rows[0].n);
    const payApproved = Number((await q(`SELECT count(*)::int n FROM actor_wallet_payout_requests WHERE tenant_id=$1 AND status='approved'`, [TENANT])).rows[0].n);
    record('T24 nenhum approved real nasce (zero approval/payout approved)', apprApproved === 0 && payApproved === 0, `appr=${apprApproved} pay=${payApproved}`);

    // T25 — nenhum ledger nasce (bank_ledger intocado no run inteiro).
    record('T25 nenhum ledger nasce (bank_ledger imutável no run)', (await snap('bank_ledger')) === lB, `before=${lB} after=${await snap('bank_ledger')}`);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ Endpoint de aprovação FAIL-CLOSED: resolve request/approval, exige requester!=approver, política ausente → PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED; zero aprovação, zero dinheiro — verde.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
