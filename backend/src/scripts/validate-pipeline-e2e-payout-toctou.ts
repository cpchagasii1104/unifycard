/**
 * E2E F-PAYOUT-TOCTOU-SAFETY-HARDENING — prova que EXECUTE-TIME nunca é mais permissivo que
 * APPROVAL-TIME no payout de actor_wallet. Em DB EFÊMERO (nunca unificard_dev).
 *
 * Cenários (todos: aprovar pedido → mudar condição entre approval e execute → execute deve bloquear):
 *   T1 happy: actor limpo (KYC approved, sem obrigação pendente, limite ok) → execute completa.
 *   T2 KYC: kyc_status volta a 'pending' após approval → execute bloqueia PAYOUT_KYC_NOT_APPROVED_AT_EXECUTE.
 *   T3 recovery: obrigação 'pending_approval' nasce após approval → execute bloqueia
 *      PAYOUT_RECOVERY_PENDING_APPROVAL_AT_EXECUTE (não drena pending_approval, não ignora).
 *   T4 risco/envelope: limite de PAYOUT baixo (50) e de TRANSFER alto (1_000_000); payout de 100 →
 *      execute bloqueia PAYOUT_RISK_NOT_CLEARED_AT_EXECUTE (prova que usa envelope de payout, não transfer).
 *   T5 ATL: authority_root 'suspended' → execute bloqueia PAYOUT_ATL_NOT_CLEARED_AT_EXECUTE.
 *
 * NÃO ativa worker, NÃO abre HTTP execution, NÃO abre external payout, NÃO semeia PORTA-1.
 */
import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../core/database/pool';
import { bankAccountService } from '../modules/bank/bank-account.service';
import { actorWalletPayoutService, ActorWalletPayoutError } from '../modules/wallet/actor-wallet-payout.service';

dotenv.config({ path: join(process.cwd(), 'backend', '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const EXPECTED_DB = process.env.EXPECTED_DATABASE_NAME || '';

async function assertEphemeral(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('Refusing to run payout/recovery E2E against non-ephemeral database.');
  if (!EXPECTED_DB || db !== EXPECTED_DB) throw new Error(`Refusing to run E2E: db="${db}" != EXPECTED "${EXPECTED_DB}".`);
  if (!/payout|approve|decision|recovery|wallet|test|ephemeral|toctou/i.test(db)) throw new Error(`Refusing: db="${db}" not ephemeral.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let passed = 0; let failed = 0;
function ok(n: string, d = '') { passed++; console.log(`  ✓ ${n}${d ? ' — ' + d : ''}`); }
function fail(n: string, d: string) { failed++; console.error(`  ✗ ${n} — ${d}`); }
async function q(sql: string, p: unknown[] = []) { return pool.query(sql, p); }

interface Fix { userId: string; globalUserId: string; actorId: string; walletAccountId: string; settlementAccountId: string; }

async function getFixtures(): Promise<Fix> {
  const r = await q(
    `SELECT u.id AS user_id, u.global_user_id, a.id AS actor_id, ba.id AS account_id
       FROM users u
       JOIN actors a ON a.tenant_id = u.tenant_id AND a.user_id = u.id
       JOIN bank_accounts ba ON ba.tenant_id = u.tenant_id AND ba.actor_id = a.id AND ba.account_type='actor_wallet'
      WHERE u.tenant_id = $1 LIMIT 1`, [TENANT_ID]);
  if (!r.rows[0]) throw new Error('sem actor com actor_wallet para tenant ' + TENANT_ID);
  const row = r.rows[0] as any;
  const settlement = await bankAccountService.getPlatformLifecycleAccount(TENANT_ID, 'bank_settlement', 'BRL');
  if (!settlement) throw new Error('bank_settlement ausente');
  return { userId: row.user_id, globalUserId: row.global_user_id, actorId: row.actor_id, walletAccountId: row.account_id, settlementAccountId: settlement.accountId };
}

async function seedWalletCredit(fix: Fix, amount: number): Promise<void> {
  if (amount <= 0) return;
  const txId = uuidv4();
  const cid = (await q(`SELECT concept_id FROM concepts WHERE domain='financeiro-payout' LIMIT 1`)).rows[0].concept_id;
  await q(`INSERT INTO bank_transactions (id,tenant_id,actor_id,account_id,amount_cents,purpose,justification,reference_type,reference_id,concept_id)
           VALUES ($1,$2,$3,$4,$5,'initial_credit','e2e toctou seed','e2e_toctou_seed',$6,$7)`,
    [txId, TENANT_ID, fix.actorId, fix.walletAccountId, amount, txId, cid]);
  await q(`INSERT INTO bank_ledger (id,tenant_id,account_id,transaction_id,direction,amount_cents,purpose,justification)
           VALUES (gen_random_uuid(),$1,$2,$3,'credit',$4,'initial_credit','e2e toctou seed')`,
    [TENANT_ID, fix.walletAccountId, txId, amount]);
}

async function walletBalance(accountId: string): Promise<number> {
  const r = await q(`SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END),0)::bigint AS b
                       FROM bank_ledger WHERE tenant_id=$1 AND account_id=$2`, [TENANT_ID, accountId]);
  return Number(r.rows[0].b);
}

async function ensureNoActiveRequest(actorId: string): Promise<void> {
  await q(`UPDATE actor_wallet_payout_requests SET status='cancelled'
            WHERE tenant_id=$1 AND actor_id=$2 AND status IN ('pending_approval','approved','processing')`, [TENANT_ID, actorId]);
}

async function setupApproved(fix: Fix, amount: number, label: string): Promise<string> {
  const idem = `toctou-${label}-${uuidv4().slice(0, 8)}`;
  const res = await actorWalletPayoutService.requestActorWalletPayout({
    tenantId: TENANT_ID, actorId: fix.actorId, requestedByUserId: fix.userId,
    requestedAmountCents: amount, idempotencyKey: idem, reason: `e2e toctou ${label}`,
  });
  const pid = res.payoutRequest.id;
  await q(`UPDATE approval_requests SET status='approved' WHERE id=$1`, [res.payoutRequest.approvalRequestId]);
  await q(`UPDATE actor_wallet_payout_requests SET status='approved', approved_amount_cents=$1 WHERE id=$2`, [amount, pid]);
  return pid;
}

async function insertPendingApprovalOblig(fix: Fix, amount: number): Promise<string> {
  const cred = (await q(`SELECT a.id AS actor_id, ba.id AS account_id FROM actors a
      JOIN bank_accounts ba ON ba.actor_id=a.id AND ba.tenant_id=a.tenant_id
      WHERE a.tenant_id=$1 AND a.id != $2 LIMIT 1`, [TENANT_ID, fix.actorId])).rows[0];
  if (!cred) throw new Error('sem creditor para obrigação');
  const cid = (await q(`SELECT concept_id FROM concepts WHERE domain='financeiro-payout' LIMIT 1`)).rows[0].concept_id;
  const txId = uuidv4();
  await q(`INSERT INTO bank_transactions (id,tenant_id,actor_id,account_id,amount_cents,purpose,justification,reference_type,reference_id,concept_id)
           VALUES ($1,$2,$3,$4,$5,'execution','e2e toctou oblig','e2e_toctou_oblig',$6,$7)`,
    [txId, TENANT_ID, fix.actorId, fix.walletAccountId, amount, txId, cid]);
  const intentId = uuidv4();
  await q(`INSERT INTO payment_intents (id,tenant_id,actor_id,amount_cents,currency,intent_type,gateway,payment_status,reference_id)
           VALUES ($1,$2,$3,$4,'BRL','e2e_fixture','unknown','released_to_actor_wallet',$5)`,
    [intentId, TENANT_ID, fix.actorId, amount, intentId]);
  const obId = uuidv4();
  await q(`INSERT INTO actor_wallet_recovery_obligations
      (id,tenant_id,debtor_actor_id,debtor_account_id,creditor_actor_id,creditor_account_id,
       original_transaction_id,payment_intent_id,amount_cents,reason,status,recovered_amount_cents,approval_request_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'e2e-toctou-pending','pending_approval',0,NULL)`,
    [obId, TENANT_ID, fix.actorId, fix.walletAccountId, cred.actor_id, cred.account_id, txId, intentId, amount]);
  return obId;
}

async function main() {
  await assertEphemeral();
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('E2E PAYOUT TOCTOU SAFETY (execute-time >= approval-time)');
  console.log('═══════════════════════════════════════════════════════════\n');
  const fix = await getFixtures();
  if (await walletBalance(fix.walletAccountId) < 5000) await seedWalletCredit(fix, 5000);
  console.log('Fixtures:', { actorId: fix.actorId, wallet: fix.walletAccountId, tenant: TENANT_ID });

  try {
    // ── T1 happy ──────────────────────────────────────────────────────────────
    console.log('T1 — happy: actor limpo → execute completa');
    await ensureNoActiveRequest(fix.actorId);
    try {
      const pid = await setupApproved(fix, 1, 't1');
      const res = await actorWalletPayoutService.executeActorWalletPayout(TENANT_ID, pid, fix.userId);
      if (res.result === 'completed') ok('T1 happy', `completed exec=${res.executedAmountCents}`);
      else fail('T1 happy', `result=${res.result}`);
    } catch (e: any) { fail('T1 happy', e.message); }

    // ── T2 KYC volta a pending após approval ───────────────────────────────────
    console.log('T2 — KYC pending após approval → bloqueia execute');
    await ensureNoActiveRequest(fix.actorId);
    try {
      const pid = await setupApproved(fix, 1, 't2');
      await q(`UPDATE identities SET kyc_status='pending' WHERE global_user_id=$1`, [fix.globalUserId]);
      try {
        await actorWalletPayoutService.executeActorWalletPayout(TENANT_ID, pid, fix.userId);
        fail('T2 KYC', 'deveria bloquear');
      } catch (e: any) {
        if (e instanceof ActorWalletPayoutError && e.code === 'PAYOUT_KYC_NOT_APPROVED_AT_EXECUTE') ok('T2 KYC', e.code);
        else fail('T2 KYC', `code=${e.code} msg=${e.message}`);
      } finally {
        await q(`UPDATE identities SET kyc_status='approved' WHERE global_user_id=$1`, [fix.globalUserId]);
      }
      await ensureNoActiveRequest(fix.actorId);
    } catch (e: any) { fail('T2 KYC', e.message); await q(`UPDATE identities SET kyc_status='approved' WHERE global_user_id=$1`, [fix.globalUserId]).catch(() => {}); }

    // ── T3 recovery pending_approval nasce após approval ───────────────────────
    console.log('T3 — recovery pending_approval após approval → bloqueia execute');
    await ensureNoActiveRequest(fix.actorId);
    let obId3: string | null = null;
    try {
      const pid = await setupApproved(fix, 1, 't3');
      obId3 = await insertPendingApprovalOblig(fix, 500);
      try {
        await actorWalletPayoutService.executeActorWalletPayout(TENANT_ID, pid, fix.userId);
        fail('T3 recovery', 'deveria bloquear');
      } catch (e: any) {
        if (e instanceof ActorWalletPayoutError && e.code === 'PAYOUT_RECOVERY_PENDING_APPROVAL_AT_EXECUTE') ok('T3 recovery', e.code);
        else fail('T3 recovery', `code=${e.code} msg=${e.message}`);
      }
    } catch (e: any) { fail('T3 recovery', e.message); }
    finally {
      if (obId3) await q(`DELETE FROM actor_wallet_recovery_obligations WHERE id=$1`, [obId3]).catch(() => {});
      await ensureNoActiveRequest(fix.actorId);
    }

    // ── T4 risco/envelope payout (não transfer) ────────────────────────────────
    console.log('T4 — limite payout baixo (50) / transfer alto (1M); payout 100 → bloqueia (envelope payout)');
    await ensureNoActiveRequest(fix.actorId);
    try {
      if (await walletBalance(fix.walletAccountId) < 100) await seedWalletCredit(fix, 100);
      for (const lvl of ['low', 'medium', 'high']) {
        await q(`INSERT INTO risk_financial_limits_by_level (risk_level,max_transfer_cents_per_operation,max_payment_cents_per_operation,max_payout_cents_per_operation)
                 VALUES ($1,1000000,1000000,50)
                 ON CONFLICT (risk_level) DO UPDATE SET max_transfer_cents_per_operation=1000000, max_payment_cents_per_operation=1000000, max_payout_cents_per_operation=50`, [lvl]);
      }
      await q(`INSERT INTO actor_risk_profile (actor_id,risk_level) VALUES ($1,'low')
               ON CONFLICT (actor_id) DO UPDATE SET risk_level='low', risk_score=0, flags='[]'::jsonb`, [fix.actorId]);
      const pid = await setupApproved(fix, 100, 't4');
      try {
        await actorWalletPayoutService.executeActorWalletPayout(TENANT_ID, pid, fix.userId);
        fail('T4 risk-envelope', 'deveria bloquear (payout 100 > limite payout 50)');
      } catch (e: any) {
        if (e instanceof ActorWalletPayoutError && e.code === 'PAYOUT_RISK_NOT_CLEARED_AT_EXECUTE') ok('T4 risk-envelope', `${e.code} (usa envelope payout, não transfer 1M)`);
        else fail('T4 risk-envelope', `code=${e.code} msg=${e.message}`);
      }
    } catch (e: any) { fail('T4 risk-envelope', e.message); }
    finally {
      await q(`DELETE FROM risk_financial_limits_by_level WHERE risk_level IN ('low','medium','high')`).catch(() => {});
      await ensureNoActiveRequest(fix.actorId);
    }

    // ── T5 ATL bloqueado (atl_level=0) ─────────────────────────────────────────
    // authority_roots.status só aceita 'active' (CHECK); o bloqueio de ATL canônico vem de
    // authority_trust_levels.atl_level <= 0 (evaluateAtlLayer → SSOT_ATL_BLOCKED).
    console.log('T5 — authority_trust_levels atl_level=0 → bloqueia execute');
    await ensureNoActiveRequest(fix.actorId);
    let atlInserted = false;
    try {
      await q(`INSERT INTO authority_roots (actor_id,cpf_hash,status) VALUES ($1,$2,'active')
               ON CONFLICT (actor_id) DO UPDATE SET status='active'`, [fix.actorId, 'toctou-' + uuidv4().slice(0, 12)]);
      await q(`INSERT INTO authority_trust_levels (tenant_id,actor_id,atl_level) VALUES ($1,$2,0)`, [TENANT_ID, fix.actorId]);
      atlInserted = true;
      const pid = await setupApproved(fix, 1, 't5');
      try {
        await actorWalletPayoutService.executeActorWalletPayout(TENANT_ID, pid, fix.userId);
        fail('T5 ATL', 'deveria bloquear');
      } catch (e: any) {
        if (e instanceof ActorWalletPayoutError && e.code === 'PAYOUT_ATL_NOT_CLEARED_AT_EXECUTE') ok('T5 ATL', e.code);
        else fail('T5 ATL', `code=${e.code} msg=${e.message}`);
      }
    } catch (e: any) { fail('T5 ATL', e.message); }
    finally {
      if (atlInserted) {
        await q(`DELETE FROM authority_trust_levels WHERE actor_id=$1`, [fix.actorId]).catch(() => {});
        await q(`DELETE FROM authority_roots WHERE actor_id=$1`, [fix.actorId]).catch(() => {});
      }
      await ensureNoActiveRequest(fix.actorId);
    }
  } finally {
    await q(`DELETE FROM bank_ledger WHERE transaction_id IN (SELECT id FROM bank_transactions WHERE tenant_id=$1 AND reference_type='e2e_toctou_seed')`, [TENANT_ID]).catch(() => {});
    await q(`DELETE FROM bank_transactions WHERE tenant_id=$1 AND reference_type IN ('e2e_toctou_seed','e2e_toctou_oblig')`, [TENANT_ID]).catch(() => {});
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`RESULTADO: ${passed}/${passed + failed} cenários passaram`);
  if (failed > 0) console.error(`FALHOU: ${failed}`); else console.log('TOCTOU EXECUTE-TIME FECHADO ✓');
  console.log('═══════════════════════════════════════════════════════════\n');
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('ERRO FATAL:', e); process.exit(1); });
