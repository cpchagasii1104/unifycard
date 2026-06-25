/**
 * E2E F-BANK-LOCK-BOUNDARY-MATERIAL — o lock físico de `bank_transactions` (FOR UPDATE) vive DENTRO do Bank.
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-bank-lock-boundary-ephemeral.ps1.
 *
 * Prova que `bankTransactionService.lockTransactionByReferenceForSettlement` (método canônico do Bank, agora
 * chamado pelo gateway no lugar do SELECT … FOR UPDATE inline) preserva a semântica anti-double-settlement:
 *   • lock por referência (tenant-scoped) retorna a última transação e seu external_settled_at;
 *   • referência já liquidada externamente → resolver abortaria (externalSettledAt != null);
 *   • referência inexistente → null (caller segue);
 *   • CONCORRÊNCIA: enquanto A segura o FOR UPDATE, B (com statement_timeout) NÃO obtém o lock → serializa;
 *   • READ+LOCK only: o método NÃO escreve → Δbank=0.
 * Money-free: não move dinheiro, não liga firewall, não toca PORTA-1.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { bankTransactionService } from '../modules/bank/bank-transaction.service';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/bank|lock|boundary|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Bank Lock Boundary', slug: `blb-${Date.now()}` });

  // identidade canônica mínima (FK actors) + bank_account + bank_transaction (substrato test-only).
  const gu = randomUUID(); const userId = randomUUID(); const cpf = String(Date.now()).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,'Lock Owner')`, [gu, cpf]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, TENANT_ID, `lock-${cpf}@e2e.test`, gu]);
  const actor = await ensureUserActor(TENANT_ID, userId);
  const accountId = (await pool.query<{ id: string }>(
    `INSERT INTO bank_accounts (tenant_id, actor_id, owner_type, owner_id, account_type) VALUES ($1::uuid,$2::uuid,'actor',$2,'credit') RETURNING id::text AS id`,
    [TENANT_ID, actor.actor_id]
  )).rows[0].id;
  const conceptId = (await pool.query<{ c: string }>(`SELECT concept_id::text AS c FROM concepts LIMIT 1`)).rows[0]?.c;
  const REF = randomUUID();
  const txId = (await pool.query<{ id: string }>(
    `INSERT INTO bank_transactions (tenant_id, actor_id, account_id, amount_cents, purpose, reference_id, external_settled_at, concept_id)
       VALUES ($1::uuid,$2::uuid,$3::uuid,100,'settlement',$4::uuid,NULL,$5::uuid) RETURNING id::text AS id`,
    [TENANT_ID, actor.actor_id, accountId, REF, conceptId]
  )).rows[0].id;

  const bankBefore = await count(`SELECT count(*)::int AS n FROM bank_transactions`);

  // ── T1 — lock por referência retorna a transação, ainda NÃO liquidada (externalSettledAt=null) ──
  {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const r = await bankTransactionService.lockTransactionByReferenceForSettlement(c as any, TENANT_ID, REF);
      await c.query('ROLLBACK');
      record('T1 lock por referência retorna a transação (externalSettledAt=null, não liquidada)', r !== null && r.externalSettledAt === null, JSON.stringify(r));
    } finally { c.release(); }
  }

  // ── T2 — referência JÁ liquidada externamente → resolver abortaria (externalSettledAt != null) ──
  {
    await pool.query(`UPDATE bank_transactions SET external_settled_at = now() WHERE id=$1::uuid`, [txId]); // substrato test-only
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const r = await bankTransactionService.lockTransactionByReferenceForSettlement(c as any, TENANT_ID, REF);
      await c.query('ROLLBACK');
      record('T2 referência liquidada → externalSettledAt != null (condição de abort preservada)', !!r?.externalSettledAt, JSON.stringify(r));
    } finally { c.release(); }
    await pool.query(`UPDATE bank_transactions SET external_settled_at = NULL WHERE id=$1::uuid`, [txId]); // volta ao estado
  }

  // ── T3 — referência inexistente → null (caller segue) ──
  {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const r = await bankTransactionService.lockTransactionByReferenceForSettlement(c as any, TENANT_ID, randomUUID());
      await c.query('ROLLBACK');
      record('T3 referência inexistente → null (sem lock, caller segue)', r === null, JSON.stringify(r));
    } finally { c.release(); }
  }

  // ── T4 — CONCORRÊNCIA: A segura o FOR UPDATE; B (statement_timeout) NÃO obtém o lock → serializa ──
  {
    const a = await pool.connect();
    const b = await pool.connect();
    let bBlocked = false; let bErr = '';
    try {
      await a.query('BEGIN');
      await bankTransactionService.lockTransactionByReferenceForSettlement(a as any, TENANT_ID, REF); // A trava a linha
      await b.query('BEGIN');
      await b.query(`SET LOCAL statement_timeout = 700`);
      try {
        await bankTransactionService.lockTransactionByReferenceForSettlement(b as any, TENANT_ID, REF); // B espera o lock → timeout
      } catch (e: any) { bBlocked = true; bErr = e?.code || e?.message || String(e); }
      await b.query('ROLLBACK').catch(() => {});
      await a.query('ROLLBACK');
    } finally { a.release(); b.release(); }
    record('T4 concorrência: B não obtém o FOR UPDATE enquanto A segura (lock serializa anti-double-settlement)', bBlocked, `bErr=${bErr}`);
  }

  // ── T5 — READ+LOCK only: o método NÃO escreve → Δbank=0 (bank_transactions inalterado) ──
  record('T5 método é read+lock (não escreve bank_transactions; Δbank=0)', (await count(`SELECT count(*)::int AS n FROM bank_transactions`)) === bankBefore, `before=${bankBefore}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ lock de bank_transactions vive no Bank; anti-double-settlement preservado (lock+abort); concorrência serializa; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
