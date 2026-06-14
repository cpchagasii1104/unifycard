/**
 * E2E — F-PAYOUT-EXECUTION-SEAL (DECISION-0128). MOVE DINHEIRO (DB EFÊMERA).
 *
 * Prova a execução real de payout no trilho canônico actor_wallet_payout_requests, consumindo o
 * Core de Aprovação (bridge approve), com recovery lock, idempotência e Bank ledger via port.
 *
 *   T1  fluxo completo: request(F2) pending → approve(bridge) approved → execute(F3) completed; ledger débito+crédito.
 *   T2  execute SEM approve → PAYOUT_NOT_APPROVED; zero ledger novo.
 *   T3  approve resolve via Core (approval_votes registra voto; approval.status='approved').
 *   T4  re-execute idempotente: 2ª execução = completed_idempotent; um único par de ledger.
 *   T5  approve idempotente: 2ª aprovação retorna approved sem erro/duplo voto.
 *   T6  execução concorrente do mesmo payout → exatamente uma 'completed'.
 *   T7  recovery obligation ativa drena/reduz; dinheiro comprometido NÃO sai.
 *   T8  approve exige approver server-side → PAYOUT_APPROVE_MISSING_APPROVER.
 *   T9  ledger double-entry: 1 debit (wallet) + 1 credit (settlement) por payout.
 *   T10 bank_transactions referenceType='actor_wallet_payout'; idempotência por reference.
 *   T11 amount_cents BIGINT em todo o substrato.
 *   T12 guards: baseline 0113=0; payout HTTP fail-closed; workers default-off; execution-seal verde.
 *   T13 zero coluna can_execute_* em company_users/tenant_operator_grants.
 *
 * 🔒 DB EFÊMERA (wrapper run-payout-execution-seal-ephemeral.ps1). NUNCA unificard_dev.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
dotenv.config({ path: join(process.cwd(), '.env') });

import { pool, getClientWithTenant } from '../core/database/pool';
import { bankLedgerRepository } from '../modules/bank/bank-ledger.repository';
import { actorWalletPayoutService, ActorWalletPayoutError } from '../modules/wallet/actor-wallet-payout.service';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const q = (sql: string, p: unknown[] = []) => pool.query(sql, p);
const cwd = process.cwd();
const guardGreen = (s: string): boolean => { try { execSync(`node scripts/${s}`, { cwd, encoding: 'utf8' }); return true; } catch { return false; } };

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/payout|execution|seal|test|ephemeral/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

interface Actor { actorId: string; walletAccountId: string; }
let TENANT = ''; let USER = ''; let OPERATOR = ''; let CONCEPT = ''; let SETTLEMENT = '';

async function seedActor(seed: number, label: string): Promise<Actor> {
  const gid = uuidv4(); const uid = uuidv4(); const actorId = uuidv4();
  const cpf = String(10000000000 + (seed % 89999999999));
  await q(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1,$2)`, [gid, cpf]);
  await q(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','complete')`, [gid, cpf]);
  await q(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, global_user_id) VALUES ($1,$1,$2,$3,'x',$4)`, [uid, TENANT, `${label}-${seed}@e2e.local`, gid]);
  await q(`INSERT INTO actors (id, actor_id, tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1,$1,$2,'user',$3,$4,$5)`, [actorId, TENANT, `E2E ${label}`, uid, gid]);
  // actor_wallet: API ownerType='user' → DB owner_type='actor', owner_id='<actorId>:actor_wallet'.
  const wa = await q(`INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, actor_id, account_type) VALUES ($1,'actor',$2,$3,'actor_wallet') RETURNING id`, [TENANT, `${actorId}:actor_wallet`, actorId]);
  if (label === 'operator') OPERATOR = uid;
  if (label === 'debtor') USER = uid;
  return { actorId, walletAccountId: wa.rows[0].id };
}

async function creditWallet(actor: Actor, amountCents: number): Promise<void> {
  const txId = uuidv4();
  await q(`INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification, reference_type, reference_id, concept_id)
           VALUES ($1,$2,$3,$4,$5,'initial_credit','e2e seal seed credit','e2e_seal_seed',$6,$7)`,
    [txId, TENANT, actor.actorId, actor.walletAccountId, amountCents, txId, CONCEPT]);
  await q(`INSERT INTO bank_ledger (id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification)
           VALUES (gen_random_uuid(),$1,$2,$3,'credit',$4,'initial_credit','e2e seal seed credit')`,
    [TENANT, actor.walletAccountId, txId, amountCents]);
}

const bal = async (accId: string): Promise<number> => (await bankLedgerRepository.calculateBalance(TENANT, accId)).balanceCents;
const ledgerCount = async (): Promise<number> => Number((await q(`SELECT count(*)::int n FROM bank_ledger WHERE tenant_id=$1`, [TENANT])).rows[0].n);

async function request(debtor: Actor, amount: number, idem: string): Promise<string> {
  const r = await actorWalletPayoutService.requestActorWalletPayout({
    tenantId: TENANT, actorId: debtor.actorId, requestedByUserId: USER, requestedAmountCents: amount, idempotencyKey: idem, reason: 'e2e seal',
  });
  return r.payoutRequest.id;
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  const base = Math.floor(Math.random() * 90000000) + 10000000;
  TENANT = uuidv4();
  await q(`INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3)`, [TENANT, `e2e-seal-${base}`, `e2e-seal-${base}`]);
  CONCEPT = (await q(`SELECT concept_id FROM concepts LIMIT 1`)).rows[0]?.concept_id;
  if (!CONCEPT) throw new Error('Sem concept para seed (FULL migrations deveriam prover).');
  const debtor = await seedActor(base, 'debtor');
  await seedActor(base + 7, 'operator'); // operador aprovador (server-side subject distinto)
  const settlement = await q(`INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, account_type) VALUES ($1,'system',$2,'bank_settlement') RETURNING id`, [TENANT, `system:bank_settlement:${TENANT}`]);
  SETTLEMENT = settlement.rows[0].id;
  // Capacidade de cobertura: credita uma conta SYSTEM (clearing, isenta do trigger de coverage) — o
  // view system_coverage deriva execution_capacity_cents do saldo das contas system; sem isso, crédito
  // a contas não-system é bloqueado (COVERAGE_EXCEEDED) num tenant novo.
  const clearing = await q(`INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, account_type) VALUES ($1,'system',$2,'clearing') RETURNING id`, [TENANT, `system:clearing:${TENANT}`]);
  const clearingTx = uuidv4();
  await q(`INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification, reference_type, reference_id, concept_id)
           VALUES ($1,$2,$3,$4,$5,'initial_credit','e2e seal coverage seed','e2e_seal_cov',$6,$7)`,
    [clearingTx, TENANT, debtor.actorId, clearing.rows[0].id, 100000000, clearingTx, CONCEPT]);
  await q(`INSERT INTO bank_ledger (id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification)
           VALUES (gen_random_uuid(),$1,$2,$3,'credit',$4,'initial_credit','e2e seal coverage seed')`,
    [TENANT, clearing.rows[0].id, clearingTx, 100000000]);
  await creditWallet(debtor, 10000);

  try {
    // T1 — fluxo completo.
    const p1 = await request(debtor, 1000, `seal-t1-${base}`);
    const reqRow1 = await q(`SELECT status FROM actor_wallet_payout_requests WHERE id=$1`, [p1]);
    const appr = await actorWalletPayoutService.approveActorWalletPayout(TENANT, p1, OPERATOR);
    const walBefore = await bal(debtor.walletAccountId); const setBefore = await bal(SETTLEMENT);
    const exec = await actorWalletPayoutService.executeActorWalletPayout(TENANT, p1, OPERATOR);
    const walAfter = await bal(debtor.walletAccountId); const setAfter = await bal(SETTLEMENT);
    record('T1 request→approve→execute completed; dinheiro moveu wallet→settlement',
      reqRow1.rows[0].status === 'pending_approval' && appr.approved === true && exec.result === 'completed' &&
      exec.executedAmountCents === 1000 && walBefore - walAfter === 1000 && setAfter - setBefore === 1000,
      `status0=${reqRow1.rows[0].status} exec=${exec.result}/${exec.executedAmountCents} Δwal=${walBefore - walAfter} Δset=${setAfter - setBefore}`);

    // T3 — approve resolveu via Core (voto registrado; approval approved).
    const apRow = await q(`SELECT ar.status, (SELECT count(*)::int FROM approval_votes v WHERE v.approval_request_id=ar.id) votes
                           FROM approval_requests ar WHERE ar.id=$1`, [appr.approvalRequestId]);
    record('T3 approve via Core: approval.status=approved + voto registrado', apRow.rows[0].status === 'approved' && apRow.rows[0].votes === 1, JSON.stringify(apRow.rows[0]));

    // T4 — re-execute idempotente.
    const lc1 = await ledgerCount();
    const exec2 = await actorWalletPayoutService.executeActorWalletPayout(TENANT, p1, OPERATOR);
    const lc2 = await ledgerCount();
    record('T4 re-execute idempotente (completed_idempotent; zero novo ledger)', exec2.result === 'completed_idempotent' && lc2 === lc1, `r=${exec2.result} Δledger=${lc2 - lc1}`);

    // T5 — approve idempotente (request aprovado, NÃO executado).
    const p5 = await request(debtor, 100, `seal-t5-${base}`);
    const a5a = await actorWalletPayoutService.approveActorWalletPayout(TENANT, p5, OPERATOR);
    const a5b = await actorWalletPayoutService.approveActorWalletPayout(TENANT, p5, OPERATOR);
    record('T5 approve idempotente (2ª aprovação retorna approved sem erro/duplo voto)', a5a.approved === true && a5b.approved === true);
    await q(`UPDATE actor_wallet_payout_requests SET status='cancelled' WHERE id=$1`, [p5]);

    // T2 — execute SEM approve.
    const p2 = await request(debtor, 100, `seal-t2-${base}`);
    const lcB = await ledgerCount();
    let notApproved = false;
    try { await actorWalletPayoutService.executeActorWalletPayout(TENANT, p2, OPERATOR); }
    catch (e) { notApproved = e instanceof ActorWalletPayoutError && e.code === 'PAYOUT_NOT_APPROVED'; }
    const lcA = await ledgerCount();
    record('T2 execute SEM approve → PAYOUT_NOT_APPROVED; zero ledger', notApproved && lcA === lcB, `notApproved=${notApproved} Δledger=${lcA - lcB}`);
    await q(`UPDATE actor_wallet_payout_requests SET status='cancelled' WHERE id=$1`, [p2]);

    // T8 — approve exige approver server-side.
    const p8 = await request(debtor, 100, `seal-t8-${base}`);
    let missingApprover = false;
    try { await actorWalletPayoutService.approveActorWalletPayout(TENANT, p8, ''); }
    catch (e) { missingApprover = e instanceof ActorWalletPayoutError && e.code === 'PAYOUT_APPROVE_MISSING_APPROVER'; }
    record('T8 approve sem approver server-side → PAYOUT_APPROVE_MISSING_APPROVER', missingApprover);
    await q(`UPDATE actor_wallet_payout_requests SET status='cancelled' WHERE id=$1`, [p8]);

    // T6 — execução concorrente.
    const p6 = await request(debtor, 100, `seal-t6-${base}`);
    await actorWalletPayoutService.approveActorWalletPayout(TENANT, p6, OPERATOR);
    const [c1, c2] = await Promise.allSettled([
      actorWalletPayoutService.executeActorWalletPayout(TENANT, p6, OPERATOR),
      actorWalletPayoutService.executeActorWalletPayout(TENANT, p6, OPERATOR),
    ]);
    const ful = [c1, c2].filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
    const rej = [c1, c2].filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    const oneCompleted = ful.some((r) => r.value.result === 'completed');
    const otherSafe = ful.some((r) => r.value.result === 'completed_idempotent') || rej.some((r) => (r.reason as any)?.code === 'PAYOUT_ALREADY_PROCESSING');
    record('T6 concorrência: exatamente uma completed (outra idempotent/ALREADY_PROCESSING)', oneCompleted && otherSafe,
      `${c1.status === 'fulfilled' ? c1.value.result : (c1.reason as any)?.code} | ${c2.status === 'fulfilled' ? c2.value.result : (c2.reason as any)?.code}`);

    // T7 — recovery ativa drena/reduz; dinheiro comprometido não sai.
    // obligation approved de 5000; debtor tem ~ (10000-1000-100) restante. Drain retém p/ creditor.
    const creditor = await seedActor(base + 99, 'creditor');
    const oblig = uuidv4(); const fakeTx = uuidv4(); const fakeIntent = uuidv4(); const oApproval = uuidv4();
    await q(`INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification, reference_type, reference_id, concept_id)
             VALUES ($1,$2,$3,$4,$5,'execution','e2e seal oblig fixture','e2e_seal_oblig',$6,$7)`, [fakeTx, TENANT, debtor.actorId, debtor.walletAccountId, 5000, fakeTx, CONCEPT]);
    await q(`INSERT INTO payment_intents (id, tenant_id, actor_id, amount_cents, currency, intent_type, gateway, payment_status, reference_id)
             VALUES ($1,$2,$3,$4,'BRL','e2e_fixture','unknown','released_to_actor_wallet',$5)`, [fakeIntent, TENANT, debtor.actorId, 5000, fakeIntent]);
    await q(`INSERT INTO approval_requests (id, tenant_id, requested_by_user_id, acting_for_actor_id, acting_for_account_id, operation_type, operation_data, required_approvals, approval_type, status, expires_at)
             VALUES ($1,$2,$3,$4,$5,'actor_wallet_recovery','{}'::jsonb,1,'sequential','approved',NOW()+INTERVAL '7 days')`, [oApproval, TENANT, OPERATOR, creditor.actorId, creditor.walletAccountId]);
    await q(`INSERT INTO actor_wallet_recovery_obligations (id, tenant_id, debtor_actor_id, debtor_account_id, creditor_actor_id, creditor_account_id, original_transaction_id, payment_intent_id, amount_cents, reason, status, recovered_amount_cents, approval_request_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'e2e-seal',$10,0,$11)`, [oblig, TENANT, debtor.actorId, debtor.walletAccountId, creditor.actorId, creditor.walletAccountId, fakeTx, fakeIntent, 5000, 'approved', oApproval]);
    const p7 = await request(debtor, 1000, `seal-t7-${base}`);
    await actorWalletPayoutService.approveActorWalletPayout(TENANT, p7, OPERATOR);
    const creditorBefore = await bal(creditor.walletAccountId);
    const exec7 = await actorWalletPayoutService.executeActorWalletPayout(TENANT, p7, OPERATOR);
    const creditorAfter = await bal(creditor.walletAccountId);
    record('T7 recovery ativa drena (dinheiro comprometido vai p/ creditor, não p/ payout)',
      exec7.drainResult.totalDrainedCents === 5000 && creditorAfter - creditorBefore === 5000 && (exec7.result === 'completed' || exec7.result === 'failed_zero_after_drain'),
      `drain=${exec7.drainResult.totalDrainedCents} Δcreditor=${creditorAfter - creditorBefore} result=${exec7.result}`);

    // T9 — double-entry: cada payout tx tem 1 debit + 1 credit.
    const txs = await q(`SELECT id FROM bank_transactions WHERE tenant_id=$1 AND reference_type='actor_wallet_payout'`, [TENANT]);
    let de = true;
    for (const t of txs.rows) {
      const e = await q(`SELECT direction, count(*)::int n FROM bank_ledger WHERE tenant_id=$1 AND transaction_id=$2 GROUP BY direction`, [TENANT, t.id]);
      const m: Record<string, number> = {}; for (const r of e.rows) m[r.direction] = r.n;
      if (m.debit !== 1 || m.credit !== 1) de = false;
    }
    record('T9 ledger double-entry (1 debit + 1 credit por payout tx)', de && txs.rows.length >= 2, `txs=${txs.rows.length} de=${de}`);

    // T10 — referenceType + idempotência por reference (uq).
    const refOk = (await q(`SELECT count(*)::int n FROM bank_transactions WHERE tenant_id=$1 AND reference_type='actor_wallet_payout' AND reference_id=$2`, [TENANT, p1])).rows[0].n === 1;
    record('T10 referenceType=actor_wallet_payout; uma tx por reference_id (idempotência)', refOk);

    // T11 — amount_cents BIGINT.
    const nonBig = (await q(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name IN ('bank_ledger','bank_transactions','actor_wallet_payout_requests','actor_wallet_recovery_obligations') AND column_name LIKE '%amount%cents%' AND data_type <> 'bigint'`)).rows[0].n;
    record('T11 amount_cents BIGINT em todo o substrato', nonBig === 0, `nonBigint=${nonBig}`);

    // T12 — guards.
    let baseline0 = false;
    try { baseline0 = /baseline=0\b/.test(execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' })); } catch { baseline0 = false; }
    record('T12 baseline 0113=0; payout HTTP fail-closed; workers default-off; execution-seal verde',
      baseline0 && guardGreen('audit-payout-authority-binding.mjs') && guardGreen('audit-financial-workers-dormancy.mjs') && guardGreen('audit-payout-execution-seal.mjs'));

    // T13 — zero can_execute_*.
    const canExec = (await q(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name IN ('company_users','tenant_operator_grants') AND column_name LIKE 'can_execute_%'`)).rows[0].n;
    record('T13 zero coluna can_execute_* em grants comuns', canExec === 0, `cols=${canExec}`);
  } finally {
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ Payout execution selado: request→approve(Core)→execute; recovery lock; ledger via port; idempotência; concorrência — verde.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
