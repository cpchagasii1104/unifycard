/**
 * e2e-referral-cascade-intent-premoney.ts — DECISION-0153 (Referral Cascade Model B), prova PRÉ-MONEY.
 *
 * Prova SÓ a camada de VÍNCULO + RESOLUÇÃO (não-financeira) do Modelo B:
 *   A indica B → user_referral_links grava A→B → getActiveReferral(B) resolve owner_actor_id de A.
 * NÃO chama calculateSplits (ele cria actor_wallet via ensureActorWalletAccount = write financeiro) nem
 * createTransactionWithSplits. Prova Δbank_ledger=0, Δbank_splits=0, Δbank_accounts=0. Referral NÃO concede permissão.
 * A prova de SPLIT-INTENT + earning real (bank_ledger/wallet) é FINANCEIRA → HOLD (Camada 1, 3 paralelas).
 */
import { randomUUID } from 'crypto';
import { loadBackendEnv } from '../core/db/load-backend-env';

loadBackendEnv();

const TENANT = process.env.E2E_TENANT_ID?.trim() || 'fbe13b78-4516-493d-905a-363796aea1d1';
const CODE = 'E2ECASC' + randomUUID().slice(0, 6).toUpperCase();
const CODE_ID = randomUUID();

const fails: string[] = [];
const ok = (cond: boolean, label: string) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) fails.push(label); };

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL ausente'); process.exit(1); }
  const { pool } = await import('../core/database/pool');
  const { referralService } = await import('../core/referral/referral.service');
  const { getActiveReferral } = await import('../core/referral/referral-helper.service');

  const c = await pool.connect();
  await c.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT]);

  const bank0 = (await c.query(`SELECT
      (SELECT count(*) FROM bank_ledger WHERE tenant_id=$1) AS l,
      (SELECT count(*) FROM bank_splits WHERE tenant_id=$1) AS s,
      (SELECT count(*) FROM bank_accounts WHERE tenant_id=$1) AS a`, [TENANT])).rows[0];

  let bUser = '';
  try {
    // A = referrer (actor sem código ativo); B = referred (user-actor SEM link prévio, ≠ A).
    const aRow = await c.query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM actors WHERE tenant_id=$1 AND actor_type='user' AND user_id IS NOT NULL
        AND id NOT IN (SELECT owner_actor_id FROM actor_referral_codes WHERE tenant_id=$1 AND code_status='active') LIMIT 1`, [TENANT]);
    const bRow = await c.query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM actors WHERE tenant_id=$1 AND actor_type='user' AND user_id IS NOT NULL
        AND user_id NOT IN (SELECT referred_user_id FROM user_referral_links WHERE tenant_id=$1)
        AND id <> $2 LIMIT 1`, [TENANT, aRow.rows[0]?.id]);
    if (!aRow.rows[0] || !bRow.rows[0]) { console.error('fixture: sem actor A/B elegível'); process.exit(1); }
    const A = aRow.rows[0].id, AU = aRow.rows[0].user_id; bUser = bRow.rows[0].user_id;
    console.log(`    fixture: referrer A=${A} referred B(user)=${bUser}`);

    // código ATIVO actor-scoped do indicador A
    await c.query(
      `INSERT INTO actor_referral_codes (id, tenant_id, owner_actor_id, code, code_status, created_by_actor_id, created_by_user_id)
       VALUES ($1,$2,$3,$4,'active',$3,$5)`, [CODE_ID, TENANT, A, CODE, AU]);
    console.log('\n=== FIXTURE committed (código ativo de A) ===\n');

    // 1) A indica B (writer canônico) → referrerActorId = A
    const applied = await referralService.applyReferralCode(TENANT, bUser, CODE);
    ok(applied.referrerActorId === A, `1. applyReferralCode → referrerActorId = A (${applied.referrerActorId === A})`);

    // 2) link gravado A→B em user_referral_links
    const link = await c.query(`SELECT referrer_actor_id FROM user_referral_links WHERE tenant_id=$1 AND referred_user_id=$2`, [TENANT, bUser]);
    ok(link.rows[0]?.referrer_actor_id === A, `2. user_referral_links grava A→B (referrer_actor_id=A)`);

    // 3) getActiveReferral(B) resolve owner_actor_id de A (a resolução que o split-engine consome)
    const active = await getActiveReferral(TENANT, bUser);
    ok(active?.referrerActorId === A, `3. getActiveReferral(B) resolve owner_actor_id de A (${active?.referrerActorId === A})`);

    // 4) PRÉ-MONEY: zero escrita financeira (NÃO chamamos calculateSplits/createTransactionWithSplits)
    const bank1 = (await c.query(`SELECT
        (SELECT count(*) FROM bank_ledger WHERE tenant_id=$1) AS l,
        (SELECT count(*) FROM bank_splits WHERE tenant_id=$1) AS s,
        (SELECT count(*) FROM bank_accounts WHERE tenant_id=$1) AS a`, [TENANT])).rows[0];
    ok(bank1.l === bank0.l && bank1.s === bank0.s && bank1.a === bank0.a,
      `4. Δbank = 0 (ledger ${bank0.l}→${bank1.l} · splits ${bank0.s}→${bank1.s} · accounts ${bank0.a}→${bank1.a})`);

    console.log('\n    ℹ️  SPLIT-INTENT (calculateSplits) + earning real (bank_ledger/wallet) = FINANCEIRO → HOLD (Camada 1, 3 paralelas).');
  } finally {
    if (bUser) await c.query(`DELETE FROM user_referral_links WHERE tenant_id=$1 AND referred_user_id=$2`, [TENANT, bUser]).catch(() => {});
    await c.query(`DELETE FROM actor_referral_codes WHERE id=$1`, [CODE_ID]).catch(() => {});
    c.release();
    console.log('\n=== TEARDOWN ok ===');
  }

  if (fails.length > 0) { console.error(`\n=== FALHAS (${fails.length}) ===`); process.exit(1); }
  console.log('\n=== RESULTADO: VÍNCULO+RESOLUÇÃO PRÉ-MONEY OK ✅ (Modelo B, zero dinheiro) ===');
  await pool.end().catch(() => {});
}

main().catch((e) => { console.error('💥', e); process.exit(1); });
