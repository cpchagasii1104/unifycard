/**
 * E2E DECISION-0090 Fase 2.2 — adminOverrideToVerified DESABILITADO.
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-adminoverride-disabled-ephemeral.ps1.
 *
 * Prova o caminho REAL (companiesService.adminOverrideToVerified):
 *   - a chamada LANÇA erro de domínio (code PJ_LEGACY_VERIFIED_OVERRIDE_DISABLED).
 *   - NÃO escreve company_status (segue 'PROVISIONAL') nem is_verified (segue false), no banco.
 *   - zero Bank.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { rbacService } from '../core/rbac/rbac.service';
import { authService } from '../core/auth/auth.service';
import { companiesService } from '../core/companies/companies.service';

const TENANT_ID = '11111111-2222-3333-4444-555555555555';
const PASSWORD = '123456';
const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function validCpf(): string {
  const n: number[] = []; for (let i = 0; i < 9; i++) n.push(Math.floor(Math.random() * 10));
  const dig = (len: number) => { let s = 0; for (let i = 0; i < len; i++) s += n[i] * (len + 1 - i); const r = s % 11; return r < 2 ? 0 : 11 - r; };
  n.push(dig(9)); n.push(dig(10)); return n.join('');
}

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — esta validação NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/adminoverride|override|disabled|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}
async function wireSocialPorts(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  await wireSocialPorts();

  if ((await pool.query('SELECT id FROM tenants WHERE id=$1', [TENANT_ID])).rowCount === 0) {
    await tenantService.createTenant({ id: TENANT_ID, name: 'PJ adminOverride disabled Test', slug: 'pj-adminoverride-disabled-test' });
  }
  await rbacService.seedDefaultRBAC(TENANT_ID);

  const ownerEmail = 'adminoverride-owner@unificard.test';
  if ((await pool.query('SELECT user_id FROM users WHERE email=$1', [ownerEmail.toLowerCase()])).rowCount === 0) {
    await authService.register(TENANT_ID, ownerEmail, PASSWORD, validCpf(), 'AO Owner');
  }
  const ownerRow = await pool.query<{ global_user_id: string }>(
    'SELECT global_user_id::text FROM users WHERE email=$1 AND tenant_id=$2 LIMIT 1',
    [ownerEmail.toLowerCase(), TENANT_ID]
  );
  const ownerGlobalUserId = ownerRow.rows[0].global_user_id;

  const c = await pool.query<{ company_id: string }>(
    `INSERT INTO companies (tenant_id, global_user_id, company_name, fiscal_identity_id, status, company_status)
     VALUES ($1,$2::uuid,'Razao Override',NULL,'active','PROVISIONAL') RETURNING company_id::text`,
    [TENANT_ID, ownerGlobalUserId]
  );
  const companyId = c.rows[0].company_id;

  const bankBefore = await pool
    .query<{ n: string }>(`SELECT (COALESCE((SELECT count(*) FROM bank_ledger),0)+COALESCE((SELECT count(*) FROM bank_transactions),0))::text n`)
    .then((r) => parseInt(r.rows[0].n, 10)).catch(() => -1);

  // ═══ adminOverrideToVerified deve LANÇAR e não escrever nada ═══
  console.log('\n— adminOverrideToVerified desabilitado —');
  let threw = false; let code = ''; let msg = '';
  try {
    await companiesService.adminOverrideToVerified(companyId, ownerGlobalUserId, TENANT_ID);
  } catch (e: any) {
    threw = true;
    code = e?.code ?? '';
    msg = e?.message ?? '';
  }
  record('1 adminOverrideToVerified LANÇA erro', threw, `threw=${threw}`);
  record('2 erro tem code PJ_LEGACY_VERIFIED_OVERRIDE_DISABLED',
    code === 'PJ_LEGACY_VERIFIED_OVERRIDE_DISABLED' || /PJ_LEGACY_VERIFIED_OVERRIDE_DISABLED/.test(msg),
    `code=${code} msg=${msg}`);

  // Confirma no banco que nada foi escrito.
  const dbRow = await pool.query<{ company_status: string }>(
    'SELECT company_status FROM companies WHERE company_id=$1::uuid', [companyId]);
  record('3 banco: company_status=PROVISIONAL (NÃO escreveu VERIFIED; is_verified dropado 3.3-B2)',
    dbRow.rows[0].company_status === 'PROVISIONAL',
    `company_status=${dbRow.rows[0].company_status}`);

  // Nenhum audit metadata 'validation' (ADMIN_OVERRIDE) no page-actor (não havia page-actor; mesmo assim, 0).
  const auditCount = await pool.query<{ n: string }>(
    `SELECT count(*)::text n FROM actors
      WHERE tenant_id=$1::uuid AND company_id=$2::uuid AND metadata->'validation' IS NOT NULL`,
    [TENANT_ID, companyId]);
  record('4 nenhum audit validation/ADMIN_OVERRIDE gravado', parseInt(auditCount.rows[0].n, 10) === 0,
    `audit_validation=${auditCount.rows[0].n}`);

  const bankAfter = await pool
    .query<{ n: string }>(`SELECT (COALESCE((SELECT count(*) FROM bank_ledger),0)+COALESCE((SELECT count(*) FROM bank_transactions),0))::text n`)
    .then((r) => parseInt(r.rows[0].n, 10)).catch(() => -1);
  record('5 zero Bank (ledger/transactions inalterados)', bankBefore === bankAfter, `before=${bankBefore} after=${bankAfter}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '✨' : '❌'} ${results.length - failed.length}/${results.length} verdes`);
  await pool.end();
  if (failed.length > 0) process.exit(1);
}

main().catch(async (e) => { console.error('FATAL', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
