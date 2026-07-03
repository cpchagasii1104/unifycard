/**
 * E2E — F-GUC-CROSS-CONTEXT-RESET-ON-REUSE-FIX (achado A1 da re-auditoria adversarial de
 * 2026-07-02). NÃO MOVE DINHEIRO. Prova, com REUSO REAL da mesma conexão física pooled
 * (DATABASE_POOL_MAX=1 força isso — determinístico, não depende de sorte de escalonamento) e
 * RLS real (role probe NOSUPERUSER/NOBYPASSRLS), que o vazamento cross-context NÃO acontece
 * mais.
 *
 *   A. mecanismo: getClientWithPlatformAdmin → release → getClientWithTenant(B) na MESMA conexão
 *      física → app.is_platform_admin lido como 'false' (não herda 'true' do uso anterior)
 *   B. mecanismo inverso: getClientWithTenant(A) → release → getClientWithPlatformAdmin() na
 *      MESMA conexão física → app.current_tenant lido como '' (não herda tenantId de A)
 *   C. PROVA DE SEGURANÇA REAL (não só GUC): sob SET ROLE unificard_app, uma conexão que serviu
 *      curadoria admin (viu os 3 canonical_services: global+scoped-A+scoped-B) e foi liberada,
 *      reutilizada por um pedido de tenant B comum, NÃO vê o scoped de A (só global+próprio)
 *   D. Δbank=0 · guard estrutural verde
 *
 * 🔒 DB EFÊMERA. NUNCA toca unificard_dev. Requer DATABASE_POOL_MAX=1 (setado pelo runner).
 */
import 'tsconfig-paths/register';
import { pool, getClientWithTenant, getClientWithPlatformAdmin } from '../core/database/pool';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/guc|reset|reuse|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  if (process.env.DATABASE_POOL_MAX !== '1') {
    throw new Error('ABORT: este E2E exige DATABASE_POOL_MAX=1 para forçar reuso determinístico da mesma conexão física.');
  }
  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  console.log('\n— A: getClientWithPlatformAdmin → release → getClientWithTenant(B) na MESMA conexão —');
  const adminClient1 = await getClientWithPlatformAdmin();
  const adminBackendPid1 = (await adminClient1.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  adminClient1.release();

  const TENANT_B = randomUUID();
  const tenantClient = await getClientWithTenant(TENANT_B);
  const tenantBackendPid = (await tenantClient.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  record('(pré-condição) mesma conexão física reutilizada (mesmo backend pid)', adminBackendPid1 === tenantBackendPid, `admin_pid=${adminBackendPid1} tenant_pid=${tenantBackendPid}`);
  const adminFlagAfterReuse = (await tenantClient.query<{ v: string }>(`SELECT current_setting('app.is_platform_admin', true) AS v`)).rows[0].v;
  record('A app.is_platform_admin lido como "false" após reuso (NÃO herda "true" do uso admin anterior)', adminFlagAfterReuse === 'false', `v=${JSON.stringify(adminFlagAfterReuse)}`);
  tenantClient.release();

  console.log('\n— B: getClientWithTenant(A) → release → getClientWithPlatformAdmin() na MESMA conexão —');
  const TENANT_A = randomUUID();
  const tenantClient2 = await getClientWithTenant(TENANT_A);
  tenantClient2.release();
  const adminClient2 = await getClientWithPlatformAdmin();
  const tenantFlagAfterReuse = (await adminClient2.query<{ v: string }>(`SELECT current_setting('app.current_tenant', true) AS v`)).rows[0].v;
  // Achado N2: o reset admin usa NO_TENANT_SENTINEL (nil-UUID cast-safe), NÃO '' (que estouraria
  // ''::uuid em policies com CAST). Prova: não herda o tenantId de A E é o sentinel nil-UUID.
  const NIL_UUID = '00000000-0000-0000-0000-000000000000';
  record('B app.current_tenant reset p/ nil-UUID sentinel após reuso (NÃO herda tenantId de A; cast-safe, achado N2)',
    tenantFlagAfterReuse === NIL_UUID && tenantFlagAfterReuse !== TENANT_A, `v=${JSON.stringify(tenantFlagAfterReuse)}`);
  adminClient2.release();

  // ── C: PROVA DE SEGURANÇA REAL sob SET ROLE unificard_app ──
  console.log('\n— C: prova de segurança real (SET ROLE unificard_app, catalog RLS) —');
  const T_A = randomUUID();
  const T_B = randomUUID();
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,'GUC Reuse E2E A',$2)`, [T_A, `guc-reuse-e2e-a-${T_A.slice(0, 8)}`]);
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,'GUC Reuse E2E B',$2)`, [T_B, `guc-reuse-e2e-b-${T_B.slice(0, 8)}`]);

  const gc = await pool.connect();
  let csScopedA: string;
  try {
    await gc.query('BEGIN');
    await gc.query(`SELECT set_config('app.concept_governance','true', true)`);
    const concept = await gc.query<{ concept_id: string }>(`INSERT INTO concepts (domain, slug) VALUES ('servicos',$1) RETURNING concept_id`, [`guc-reuse-e2e-${randomUUID().slice(0, 8)}`]);
    const cs = await gc.query<{ id: string }>(
      `INSERT INTO canonical_services (tenant_id, scope, concept_id, name, slug, status) VALUES ($1,'scoped',$2,'GUC Reuse E2E Scoped A','guc-reuse-e2e-scoped-a','active') RETURNING id`,
      [T_A, concept.rows[0].concept_id]
    );
    csScopedA = cs.rows[0].id;
    await gc.query('COMMIT');
  } catch (e) {
    await gc.query('ROLLBACK');
    throw e;
  } finally {
    gc.release();
  }

  const securityClient = await pool.connect();
  try {
    await securityClient.query('SET ROLE unificard_app');

    // Passo 1: sessão serve curadoria ADMIN — vê o scoped de A (bypass legítimo, gated por role na rota).
    await securityClient.query(
      "SELECT set_config('app.is_platform_admin', 'true', false), set_config('app.current_tenant', '', false)"
    );
    const seenAsAdmin = (await securityClient.query<{ id: string }>(`SELECT id::text AS id FROM canonical_services WHERE id = $1::uuid`, [csScopedA])).rows;
    record('(pré-condição) curadoria admin vê scoped de A nesta conexão', seenAsAdmin.length === 1);

    // Passo 2: MESMA sessão/conexão agora serve um pedido de TENANT B comum. NOTA DE HONESTIDADE
    // (achado da re-auditoria): aqui reproduzimos o SQL byte-idêntico ao que getClientWithTenant emite
    // (não chamamos o helper direto porque, sob SET ROLE nesta MESMA conexão + POOL_MAX=1, adquirir
    // outro client via helper deadlockaria o pool). O guard audit-guc-cross-context-reset-on-reuse.mjs
    // trava drift do SQL do helper, então o SQL testado aqui = o SQL de produção. Prova o mecanismo:
    // reset de is_platform_admin='false' → tenant B NÃO enxerga scoped de A na mesma conexão física.
    await securityClient.query(
      "SELECT set_config('app.current_tenant', $1, false), set_config('app.is_platform_admin', 'false', false)",
      [T_B]
    );
    const seenAsTenantB = (await securityClient.query<{ id: string }>(`SELECT id::text AS id FROM canonical_services WHERE id = $1::uuid`, [csScopedA])).rows;
    record('C tenant B NÃO vê scoped de A após reuso da conexão que serviu admin (vazamento fechado)', seenAsTenantB.length === 0, `seen=${seenAsTenantB.length}`);

    await securityClient.query('RESET ROLE');
  } finally {
    securityClient.release();
  }

  const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
  record('D Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

  let g = 0;
  try { execSync('node scripts/audit-guc-cross-context-reset-on-reuse.mjs', { cwd: process.cwd(), encoding: 'utf8' }); } catch { g = 1; }
  record('D guard estrutural verde', g === 0);

  await pool.end();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ GUC de current_tenant/is_platform_admin resetado em toda chamada — reuso de conexão pooled não vaza contexto de um caller pro próximo; vazamento cross-tenant via admin-bypass stale fechado. Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
