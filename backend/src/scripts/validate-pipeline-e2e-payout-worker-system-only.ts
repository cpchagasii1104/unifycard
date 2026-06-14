/**
 * E2E — F-PAYOUT-WORKER-SYSTEM-ONLY-SEAL (DECISION-0128). MOVE DINHEIRO (DB EFÊMERA).
 *
 * Prova o worker CANÔNICO system-only: consome SOMENTE actor_wallet_payout_requests approved e executa
 * via executeActorWalletPayout (executor selado). Default-off; sem seller_available/payout_requests legado.
 *
 *   T1  default-off: startActorWalletPayoutWorker() sem ENABLE_PAYOUT_WORKER → false (não inicia).
 *   T2  ciclo executa SÓ approved: request approved → cycle completed=1; pending_approval NÃO é executado.
 *   T3  execução via worker move dinheiro (wallet→settlement) e marca completed.
 *   T4  ciclo idempotente: 2º ciclo não reexecuta (request já completed); zero novo ledger.
 *   T5  ciclos concorrentes: exatamente uma execução; zero ledger duplicado.
 *   T6  recovery ativa: worker drena o comprometido (vai p/ creditor), não p/ payout.
 *   T7  ledger double-entry (1 debit + 1 credit por payout).
 *   T8  guards: baseline 0113=0; payout HTTP fail-closed; workers default-off; worker-system-only + execution-seal verdes.
 *   T9  zero coluna can_execute_* em grants comuns.
 *
 * 🔒 DB EFÊMERA (wrapper run-payout-worker-system-only-ephemeral.ps1). NUNCA unificard_dev.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
dotenv.config({ path: join(process.cwd(), '.env') });

import { pool } from '../core/database/pool';
import { bankLedgerRepository } from '../modules/bank/bank-ledger.repository';
import { actorWalletPayoutService } from '../modules/wallet/actor-wallet-payout.service';
import { runActorWalletPayoutWorkerCycle, startActorWalletPayoutWorker } from '../workers/actor-wallet-payout-worker';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (l: string, ok: boolean, r?: string): void => { results.push({ label: l, ok, reason: r }); console.log(`  ${ok ? '✅' : '❌'} ${l}${ok ? '' : ` — ${r ?? ''}`}`); };
const q = (sql: string, p: unknown[] = []) => pool.query(sql, p);
const cwd = process.cwd();
const guardGreen = (s: string): boolean => { try { execSync(`node scripts/${s}`, { cwd, encoding: 'utf8' }); return true; } catch { return false; } };

let TENANT = ''; let USER = ''; let OPERATOR = ''; let CONCEPT = ''; let SETTLEMENT = '';

async function assertEphemeral(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: alvo é unificard_dev.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/payout|worker|seal|test|ephemeral/i.test(db)) throw new Error(`ABORT: "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

interface Actor { actorId: string; walletAccountId: string; }
async function seedActor(seed: number, label: string): Promise<Actor> {
  const gid = uuidv4(); const uid = uuidv4(); const actorId = uuidv4(); const cpf = String(10000000000 + (seed % 89999999999));
  await q(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1,$2)`, [gid, cpf]);
  await q(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','complete')`, [gid, cpf]);
  await q(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, global_user_id) VALUES ($1,$1,$2,$3,'x',$4)`, [uid, TENANT, `${label}-${seed}@e2e.local`, gid]);
  await q(`INSERT INTO actors (id, actor_id, tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1,$1,$2,'user',$3,$4,$5)`, [actorId, TENANT, `E2E ${label}`, uid, gid]);
  const wa = await q(`INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, actor_id, account_type) VALUES ($1,'actor',$2,$3,'actor_wallet') RETURNING id`, [TENANT, `${actorId}:actor_wallet`, actorId]);
  if (label === 'debtor') USER = uid;
  if (label === 'operator') OPERATOR = uid;
  return { actorId, walletAccountId: wa.rows[0].id };
}
async function creditAccount(actorId: string, accId: string, cents: number, ref: string): Promise<void> {
  const txId = uuidv4();
  await q(`INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification, reference_type, reference_id, concept_id) VALUES ($1,$2,$3,$4,$5,'initial_credit','e2e worker seed',$6,$7,$8)`, [txId, TENANT, actorId, accId, cents, ref, txId, CONCEPT]);
  await q(`INSERT INTO bank_ledger (id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification) VALUES (gen_random_uuid(),$1,$2,$3,'credit',$4,'initial_credit','e2e worker seed')`, [TENANT, accId, txId, cents]);
}
const bal = async (a: string): Promise<number> => (await bankLedgerRepository.calculateBalance(TENANT, a)).balanceCents;
const ledgerCount = async (): Promise<number> => Number((await q(`SELECT count(*)::int n FROM bank_ledger WHERE tenant_id=$1`, [TENANT])).rows[0].n);
async function reqApproved(debtor: Actor, amount: number, idem: string): Promise<string> {
  const r = await actorWalletPayoutService.requestActorWalletPayout({ tenantId: TENANT, actorId: debtor.actorId, requestedByUserId: USER, requestedAmountCents: amount, idempotencyKey: idem, reason: 'e2e worker' });
  await actorWalletPayoutService.approveActorWalletPayout(TENANT, r.payoutRequest.id, OPERATOR);
  return r.payoutRequest.id;
}

async function main(): Promise<void> {
  await assertEphemeral();
  const base = Math.floor(Math.random() * 90000000) + 10000000;
  TENANT = uuidv4();
  await q(`INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3)`, [TENANT, `e2e-worker-${base}`, `e2e-worker-${base}`]);
  CONCEPT = (await q(`SELECT concept_id FROM concepts LIMIT 1`)).rows[0]?.concept_id;
  if (!CONCEPT) throw new Error('Sem concept.');
  const debtor = await seedActor(base, 'debtor');
  await seedActor(base + 7, 'operator');
  const clearing = await q(`INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, account_type) VALUES ($1,'system',$2,'clearing') RETURNING id`, [TENANT, `system:clearing:${TENANT}`]);
  await creditAccount(debtor.actorId, clearing.rows[0].id, 100000000, 'e2e_worker_cov'); // coverage (system, isento)
  const settlement = await q(`INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, account_type) VALUES ($1,'system',$2,'bank_settlement') RETURNING id`, [TENANT, `system:bank_settlement:${TENANT}`]);
  SETTLEMENT = settlement.rows[0].id;
  await creditAccount(debtor.actorId, debtor.walletAccountId, 10000, 'e2e_worker_seed');

  try {
    // T1 — default-off.
    const prev = process.env.ENABLE_PAYOUT_WORKER; delete process.env.ENABLE_PAYOUT_WORKER;
    const started = startActorWalletPayoutWorker();
    if (prev !== undefined) process.env.ENABLE_PAYOUT_WORKER = prev;
    record('T1 worker default-off: startActorWalletPayoutWorker() sem flag → false (não inicia)', started === false);

    // T2/T3 — ciclo executa só approved + move dinheiro.
    const p1 = await reqApproved(debtor, 1000, `wrk-t1-${base}`);
    // request pending (não approved) — não deve ser executado pelo ciclo.
    const r2 = await actorWalletPayoutService.requestActorWalletPayout({ tenantId: TENANT, actorId: debtor.actorId, requestedByUserId: USER, requestedAmountCents: 50, idempotencyKey: `wrk-pend-${base}`, reason: 'e2e pend' }).catch(() => null);
    const walB = await bal(debtor.walletAccountId); const setB = await bal(SETTLEMENT);
    const cyc = await runActorWalletPayoutWorkerCycle(10);
    const walA = await bal(debtor.walletAccountId); const setA = await bal(SETTLEMENT);
    const p1row = await q(`SELECT status, executed_amount_cents FROM actor_wallet_payout_requests WHERE id=$1`, [p1]);
    record('T2 ciclo executa SÓ approved (completed=1; pending não tocado)', cyc.completed === 1 && cyc.processed === 1, JSON.stringify(cyc));
    record('T3 execução via worker move dinheiro (wallet→settlement) e marca completed',
      p1row.rows[0].status === 'completed' && Number(p1row.rows[0].executed_amount_cents) === 1000 && walB - walA === 1000 && setA - setB === 1000,
      `status=${p1row.rows[0].status} Δwal=${walB - walA} Δset=${setA - setB}`);
    // o pending r2 segue pending_approval (não executado) — cancelar p/ liberar active-gate.
    if (r2) await q(`UPDATE actor_wallet_payout_requests SET status='cancelled' WHERE id=$1`, [r2.payoutRequest.id]);

    // T4 — ciclo idempotente.
    const lc1 = await ledgerCount();
    const cyc2 = await runActorWalletPayoutWorkerCycle(10);
    const lc2 = await ledgerCount();
    record('T4 ciclo idempotente: nada novo a processar; zero novo ledger', cyc2.processed === 0 && lc2 === lc1, `processed=${cyc2.processed} Δledger=${lc2 - lc1}`);

    // T5 — ciclos concorrentes.
    const p5 = await reqApproved(debtor, 200, `wrk-t5-${base}`);
    const lcB = await ledgerCount();
    const [a, b] = await Promise.allSettled([runActorWalletPayoutWorkerCycle(10), runActorWalletPayoutWorkerCycle(10)]);
    const lcA = await ledgerCount();
    const totalCompleted = [a, b].reduce((s, r) => s + (r.status === 'fulfilled' ? r.value.completed : 0), 0);
    const p5row = await q(`SELECT status FROM actor_wallet_payout_requests WHERE id=$1`, [p5]);
    record('T5 ciclos concorrentes: uma execução; ledger += 1 par (sem duplicidade)', totalCompleted === 1 && p5row.rows[0].status === 'completed' && lcA - lcB === 2, `completed=${totalCompleted} Δledger=${lcA - lcB}`);

    // T6 — recovery ativa.
    const creditor = await seedActor(base + 99, 'creditor');
    const oblig = uuidv4(); const fakeTx = uuidv4(); const fakeIntent = uuidv4(); const oAppr = uuidv4();
    await q(`INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification, reference_type, reference_id, concept_id) VALUES ($1,$2,$3,$4,$5,'execution','e2e worker obligation fixture','e2e_worker_oblig',$6,$7)`, [fakeTx, TENANT, debtor.actorId, debtor.walletAccountId, 3000, fakeTx, CONCEPT]);
    await q(`INSERT INTO payment_intents (id, tenant_id, actor_id, amount_cents, currency, intent_type, gateway, payment_status, reference_id) VALUES ($1,$2,$3,$4,'BRL','e2e_fixture','unknown','released_to_actor_wallet',$5)`, [fakeIntent, TENANT, debtor.actorId, 3000, fakeIntent]);
    await q(`INSERT INTO approval_requests (id, tenant_id, requested_by_user_id, acting_for_actor_id, acting_for_account_id, operation_type, operation_data, required_approvals, approval_type, status, expires_at) VALUES ($1,$2,$3,$4,$5,'actor_wallet_recovery','{}'::jsonb,1,'sequential','approved',NOW()+INTERVAL '7 days')`, [oAppr, TENANT, OPERATOR, creditor.actorId, creditor.walletAccountId]);
    await q(`INSERT INTO actor_wallet_recovery_obligations (id, tenant_id, debtor_actor_id, debtor_account_id, creditor_actor_id, creditor_account_id, original_transaction_id, payment_intent_id, amount_cents, reason, status, recovered_amount_cents, approval_request_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'e2e',$10,0,$11)`, [oblig, TENANT, debtor.actorId, debtor.walletAccountId, creditor.actorId, creditor.walletAccountId, fakeTx, fakeIntent, 3000, 'approved', oAppr]);
    const p6 = await reqApproved(debtor, 500, `wrk-t6-${base}`);
    const credB = await bal(creditor.walletAccountId);
    const cyc6 = await runActorWalletPayoutWorkerCycle(10);
    const credA = await bal(creditor.walletAccountId);
    const p6row = await q(`SELECT status FROM actor_wallet_payout_requests WHERE id=$1`, [p6]);
    record('T6 recovery ativa: worker drena comprometido p/ creditor (não p/ payout)',
      credA - credB === 3000 && (cyc6.completed === 1 || cyc6.failed === 1) && (p6row.rows[0].status === 'completed' || p6row.rows[0].status === 'failed'),
      `Δcreditor=${credA - credB} cyc=${JSON.stringify(cyc6)} status=${p6row.rows[0].status}`);

    // T7 — double-entry.
    const txs = await q(`SELECT id FROM bank_transactions WHERE tenant_id=$1 AND reference_type='actor_wallet_payout'`, [TENANT]);
    let de = true;
    for (const t of txs.rows) {
      const e = await q(`SELECT direction, count(*)::int n FROM bank_ledger WHERE tenant_id=$1 AND transaction_id=$2 GROUP BY direction`, [TENANT, t.id]);
      const m: Record<string, number> = {}; for (const r of e.rows) m[r.direction] = r.n;
      if (m.debit !== 1 || m.credit !== 1) de = false;
    }
    record('T7 ledger double-entry por payout tx', de && txs.rows.length >= 3, `txs=${txs.rows.length} de=${de}`);

    // T8 — guards.
    let baseline0 = false;
    try { baseline0 = /baseline=0\b/.test(execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' })); } catch { baseline0 = false; }
    record('T8 baseline 0113=0; HTTP fail-closed; workers default-off; worker-system-only + execution-seal verdes',
      baseline0 && guardGreen('audit-payout-authority-binding.mjs') && guardGreen('audit-financial-workers-dormancy.mjs') && guardGreen('audit-payout-worker-system-only.mjs') && guardGreen('audit-payout-execution-seal.mjs'));

    // T9 — zero can_execute_*.
    const canExec = (await q(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name IN ('company_users','tenant_operator_grants') AND column_name LIKE 'can_execute_%'`)).rows[0].n;
    record('T9 zero coluna can_execute_* em grants comuns', canExec === 0, `cols=${canExec}`);
  } finally {
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ Worker canônico system-only liga o executor selado; só approved; recovery; sem duplicidade — verde.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
