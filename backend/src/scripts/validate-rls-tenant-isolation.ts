/**
 * F-DB-ROLE-AND-RLS-HARDENING — prova MATERIAL de que o RLS deixa de ser teatro.
 *
 * Em DB EFÊMERO (nunca unificard_dev):
 *   1. confirma que a role admin (postgres) É superuser → bypassa RLS (o "teatro" a corrigir);
 *   2. confirma que unificard_app existe e é NOSUPERUSER + NOBYPASSRLS;
 *   3. semeia 2 tenants (A,B) + 2 financial_approval_policies (uma por tenant) como admin;
 *   4. como admin (superuser): SELECT vê AMBAS (bypass) — prova o teatro;
 *   5. SET ROLE unificard_app + app.current_tenant=A → SELECT vê só A; tenant=B → só B (RLS morde);
 *   6. cross-tenant INSERT (tenant=A no contexto, linha tenant=B) é BLOQUEADO por WITH CHECK;
 *   7. assertSecureDbRoleForMoneyRuntime: PASSA sob unificard_app; LANÇA DB_ROLE_IS_SUPERUSER sob admin.
 *
 * NÃO move dinheiro. NÃO abre payout. NÃO liga worker. Apenas role/RLS.
 *
 * Uso (via runner efêmero): npx tsx src/scripts/validate-rls-tenant-isolation.ts
 */
import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../core/database/pool';
import {
  assertSecureDbRoleForMoneyRuntime,
  inspectDbRoleSecurity,
  DbRoleRlsUnsafeError,
} from '../core/database/db-role-rls-preflight';

dotenv.config({ path: join(process.cwd(), '.env') });

const EXPECTED_DB = process.env.EXPECTED_DATABASE_NAME || '';

async function assertEphemeral(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('Refusing to run RLS isolation test against non-ephemeral database.');
  if (!EXPECTED_DB || db !== EXPECTED_DB) throw new Error(`Refusing RLS test: db="${db}" != EXPECTED "${EXPECTED_DB}".`);
  if (!/payout|approve|decision|recovery|wallet|test|ephemeral|rls/i.test(db)) throw new Error(`Refusing RLS test: db="${db}" not ephemeral.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let passed = 0;
let failed = 0;
function ok(name: string, detail = '') { passed++; console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`); }
function fail(name: string, detail: string) { failed++; console.error(`  ✗ ${name} — ${detail}`); }

async function main() {
  await assertEphemeral();
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('E2E RLS TENANT ISOLATION (F-DB-ROLE-AND-RLS-HARDENING)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const tenantA = uuidv4();
  const tenantB = uuidv4();
  const client = await pool.connect();
  try {
    // ── 1. admin é superuser (teatro) ────────────────────────────────────────
    const admin = await inspectDbRoleSecurity(client);
    if (admin.isSuperuser) ok('admin role é superuser (bypassa RLS — o teatro a corrigir)', admin.currentUser);
    else ok('admin role NÃO é superuser', admin.currentUser); // ambiente já endurecido — também aceitável

    // ── 2. unificard_app existe e é NOSUPERUSER/NOBYPASSRLS ───────────────────
    const appRole = (await client.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname='unificard_app'`
    )).rows[0];
    if (!appRole) { fail('unificard_app existe', 'role ausente — migration aplicada?'); }
    else if (appRole.rolsuper) fail('unificard_app NOSUPERUSER', 'rolsuper=true');
    else if (appRole.rolbypassrls) fail('unificard_app NOBYPASSRLS', 'rolbypassrls=true');
    else ok('unificard_app é NOSUPERUSER + NOBYPASSRLS');

    // ── 3. seed 2 tenants + 2 policies (como admin) ──────────────────────────
    await client.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,'RLS Test A',$2),($3,'RLS Test B',$4)`,
      [tenantA, `rls-test-a-${tenantA.slice(0, 8)}`, tenantB, `rls-test-b-${tenantB.slice(0, 8)}`]);
    for (const t of [tenantA, tenantB]) {
      await client.query(
        `INSERT INTO financial_approval_policies (tenant_id, scope, max_amount_cents, daily_limit_cents)
         VALUES ($1,'actor_wallet_payout',10000,20000)`, [t]);
    }

    // ── 4. admin vê ambas (bypass) ───────────────────────────────────────────
    const adminCount = Number((await client.query(
      `SELECT COUNT(*)::int AS n FROM financial_approval_policies WHERE tenant_id = ANY($1::uuid[])`, [[tenantA, tenantB]]
    )).rows[0].n);
    if (adminCount === 2) ok('admin SELECT vê AMBOS tenants (bypass = teatro)', `count=${adminCount}`);
    else fail('admin SELECT vê ambos', `count=${adminCount} (esperado 2)`);

    // ── 5. RLS morde sob unificard_app ───────────────────────────────────────
    await client.query('SET ROLE unificard_app');
    try {
      await client.query(`SELECT set_config('app.current_tenant', $1, false)`, [tenantA]);
      const a = Number((await client.query(`SELECT COUNT(*)::int AS n FROM financial_approval_policies`)).rows[0].n);
      await client.query(`SELECT set_config('app.current_tenant', $1, false)`, [tenantB]);
      const b = Number((await client.query(`SELECT COUNT(*)::int AS n FROM financial_approval_policies`)).rows[0].n);
      // só as linhas do tenant corrente (1 cada). Pode haver +0 de outros tenants seedados? Não — só A e B existem.
      if (a === 1 && b === 1) ok('unificard_app: RLS isola por tenant (A→1, B→1)', `a=${a} b=${b}`);
      else fail('unificard_app RLS isolação', `a=${a} b=${b} (esperado 1/1)`);

      // ── 6. cross-tenant WITH CHECK bloqueia ────────────────────────────────
      await client.query(`SELECT set_config('app.current_tenant', $1, false)`, [tenantA]);
      try {
        await client.query(
          `INSERT INTO financial_approval_policies (tenant_id, scope, max_amount_cents, daily_limit_cents)
           VALUES ($1,'actor_wallet_payout',9999,19999)`, [tenantB]);
        fail('cross-tenant INSERT bloqueado', 'INSERT tenant=B sob contexto A deveria violar WITH CHECK');
      } catch (e: any) {
        // RLS WITH CHECK violation: SQLSTATE 42501 (insufficient_privilege). Mensagem varia por locale (PT/EN).
        const isRls = e.code === '42501'
          || /row-level security|violates row-level|nível de linha|política de segurança/i.test(String(e.message));
        if (isRls) ok('cross-tenant INSERT bloqueado por WITH CHECK', e.code || 'RLS');
        else fail('cross-tenant INSERT bloqueado', `erro inesperado: ${e.message}`);
      }

      // ── 7. preflight PASSA sob unificard_app ───────────────────────────────
      try {
        await assertSecureDbRoleForMoneyRuntime(client);
        ok('assertSecureDbRoleForMoneyRuntime PASSA sob unificard_app');
      } catch (e: any) {
        fail('preflight sob unificard_app', `lançou inesperadamente: ${e.message}`);
      }
    } finally {
      await client.query('RESET ROLE');
    }

    // ── 7b. preflight LANÇA sob admin (se admin for superuser) ───────────────
    if (admin.isSuperuser) {
      try {
        await assertSecureDbRoleForMoneyRuntime(client);
        fail('preflight LANÇA sob admin superuser', 'não lançou');
      } catch (e: any) {
        if (e instanceof DbRoleRlsUnsafeError && e.code === 'DB_ROLE_IS_SUPERUSER') ok('preflight LANÇA DB_ROLE_IS_SUPERUSER sob admin');
        else fail('preflight sob admin', `erro inesperado: ${e.message}`);
      }
    }
  } finally {
    // cleanup best-effort (DB efêmero é dropado de qualquer forma)
    await client.query('RESET ROLE').catch(() => {});
    await client.query(`DELETE FROM financial_approval_policies WHERE tenant_id = ANY($1::uuid[])`, [[tenantA, tenantB]]).catch(() => {});
    await client.query(`DELETE FROM tenants WHERE id = ANY($1::uuid[])`, [[tenantA, tenantB]]).catch(() => {});
    client.release();
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`RESULTADO: ${passed}/${passed + failed} checagens passaram`);
  if (failed > 0) console.error(`FALHOU: ${failed}`);
  else console.log('RLS DEIXA DE SER TEATRO ✓');
  console.log('═══════════════════════════════════════════════════════════\n');
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('ERRO FATAL:', e); process.exit(1); });
