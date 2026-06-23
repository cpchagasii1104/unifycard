/**
 * SPLIT-01 — E2E EPHEMERAL de bank_splits append-only. Aplica a migration numa transação, prova
 * INSERT-ok / UPDATE-bloqueado / DELETE-bloqueado, e faz ROLLBACK (dev intocado, Δ bank_* = 0).
 * NÃO move dinheiro real (tudo em tx revertida). Uso: pnpm exec tsx src/scripts/e2e-bank-splits-append-only.ts
 */
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { loadBackendEnv } from '../core/db/load-backend-env';
loadBackendEnv();

const TENANT = process.env.E2E_TENANT_ID?.trim() || 'fbe13b78-4516-493d-905a-363796aea1d1';
const fails: string[] = [];
const ok = (c: boolean, l: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) fails.push(l); };
const isAppendOnly = (e: any) => /bank_splits is append-only/i.test(String(e?.message || ''));

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL ausente'); process.exit(1); }
  const { pool } = await import('../core/database/pool');
  const MIG = readFileSync(join(process.cwd(), 'migrations/20260623120000_bank_splits_append_only.sql'), 'utf-8');

  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT]);

    // aplica a MIGRATION REAL (função + 2 triggers) dentro da tx (DDL transacional → some no ROLLBACK)
    await c.query(MIG);

    // actor vivo do tenant
    const ar = await c.query<{ id: string }>(`SELECT id FROM actors WHERE tenant_id=$1 LIMIT 1`, [TENANT]);
    const actor = ar.rows[0]?.id;
    if (!actor) { console.error('sem actor no tenant p/ fixture'); await c.query('ROLLBACK'); process.exit(1); }
    const CONCEPT = (await c.query<{ concept_id: string }>(`SELECT concept_id FROM concepts LIMIT 1`)).rows[0].concept_id;

    // fixture ephemeral: account → transaction (amount 1000) → split (500, satisfaz validate_split_total)
    const acct = randomUUID(), tx = randomUUID(), split = randomUUID();
    await c.query(`INSERT INTO bank_accounts (id, tenant_id, actor_id, owner_type, owner_id, account_type) VALUES ($1::uuid,$2::uuid,$3::uuid,'actor',$3::text,'actor_wallet')`, [acct, TENANT, actor]);
    await c.query(`INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, concept_id) VALUES ($1,$2,$3,$4,1000,'split',$5)`, [tx, TENANT, actor, acct, CONCEPT]);

    // 1) INSERT legítimo continua funcionando
    let insertOk = false;
    try {
      await c.query(`INSERT INTO bank_splits (id, tenant_id, transaction_id, source_actor_id, target_account_id, amount_cents, split_type) VALUES ($1,$2,$3,$4,$5,500,'test')`, [split, TENANT, tx, actor, acct]);
      insertOk = true;
    } catch (e: any) { insertOk = false; console.log('   INSERT err:', e?.message); }
    ok(insertOk, '1. INSERT legítimo em bank_splits continua funcionando');

    // 2) UPDATE → bloqueado (append-only). SAVEPOINT: o erro não pode abortar a tx p/ o teste 3.
    let upBlocked = false;
    await c.query('SAVEPOINT sp_up');
    try { await c.query(`UPDATE bank_splits SET amount_cents=400 WHERE id=$1`, [split]); await c.query('RELEASE SAVEPOINT sp_up'); }
    catch (e: any) { upBlocked = isAppendOnly(e); await c.query('ROLLBACK TO SAVEPOINT sp_up'); }
    ok(upBlocked, '2. UPDATE em bank_splits → bloqueado (append-only)');

    // 3) DELETE → bloqueado (append-only).
    let delBlocked = false;
    await c.query('SAVEPOINT sp_del');
    try { await c.query(`DELETE FROM bank_splits WHERE id=$1`, [split]); await c.query('RELEASE SAVEPOINT sp_del'); }
    catch (e: any) { delBlocked = isAppendOnly(e); await c.query('ROLLBACK TO SAVEPOINT sp_del'); }
    ok(delBlocked, '3. DELETE em bank_splits → bloqueado (append-only)');

  } finally {
    await c.query('ROLLBACK').catch(() => {});
    c.release();
    console.log('\n=== ROLLBACK ok (dev intocado; Δ bank_* = 0) ===');
  }
  console.log(`\n=== RESULTADO: ${fails.length === 0 ? 'BANK_SPLITS APPEND-ONLY OK ✅ (INSERT ok; UPDATE/DELETE bloqueados; zero dinheiro)' : 'FALHAS: ' + fails.length} ===`);
  await pool.end().catch(() => {});
  process.exit(fails.length === 0 ? 0 : 1);
}
main().catch((e) => { console.error('ERRO FATAL:', e); process.exit(1); });
