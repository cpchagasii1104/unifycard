/**
 * E2E DECISION-0091 Fase 2.5 + DECISION-0096 Presential UX 1A — fluxo presencial PJ DESABILITADO.
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-inperson-disabled-ephemeral.ps1.
 *
 * Prova o caminho REAL (companyValidationService):
 *   - validateInPerson LANÇA erro de domínio (code PJ_LEGACY_IN_PERSON_VERIFIED_DISABLED, statusCode 501).
 *   - NÃO escreve company_status (segue 'PROVISIONAL') nem is_verified, no banco.
 *   - NÃO escreve company_validations (0 linhas).
 *   - DECISION-0096: requestValidation TAMBÉM desabilitado — LANÇA HttpError 501 (code
 *     PJ_PRESENTIAL_VALIDATION_RESERVED) ANTES de gerar qualquer token/QR (nada vaza).
 *   - statusCode 501 em ambos prova que o error-handler global emite HTTP 501 (não 400).
 *   - zero Bank.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { rbacService } from '../core/rbac/rbac.service';
import { authService } from '../core/auth/auth.service';
import { companyValidationService } from '../core/companies/company-validation.service';

const TENANT_ID = '66666666-7777-8888-9999-aaaaaaaaaaaa';
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
  if (!/inperson|disabled|fase12|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
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
    await tenantService.createTenant({ id: TENANT_ID, name: 'PJ in-person disabled Test', slug: 'pj-inperson-disabled-test' });
  }
  await rbacService.seedDefaultRBAC(TENANT_ID);

  const ownerEmail = 'inperson-owner@unificard.test';
  if ((await pool.query('SELECT user_id FROM users WHERE email=$1', [ownerEmail.toLowerCase()])).rowCount === 0) {
    await authService.register(TENANT_ID, ownerEmail, PASSWORD, validCpf(), 'IP Owner');
  }
  const ownerRow = await pool.query<{ global_user_id: string }>(
    'SELECT global_user_id::text FROM users WHERE email=$1 AND tenant_id=$2 LIMIT 1',
    [ownerEmail.toLowerCase(), TENANT_ID]
  );
  const ownerGlobalUserId = ownerRow.rows[0].global_user_id;

  const c = await pool.query<{ company_id: string }>(
    `INSERT INTO companies (tenant_id, global_user_id, company_name, fiscal_identity_id, status, company_status, is_verified)
     VALUES ($1,$2::uuid,'Razao InPerson',NULL,'active','PROVISIONAL',false) RETURNING company_id::text`,
    [TENANT_ID, ownerGlobalUserId]
  );
  const companyId = c.rows[0].company_id;

  const bankBefore = await pool
    .query<{ n: string }>(`SELECT (COALESCE((SELECT count(*) FROM bank_ledger),0)+COALESCE((SELECT count(*) FROM bank_transactions),0))::text n`)
    .then((r) => parseInt(r.rows[0].n, 10)).catch(() => -1);

  // ═══ validateInPerson deve LANÇAR e não escrever nada ═══
  console.log('\n— validateInPerson (FASE 12) desabilitado —');
  let threw = false; let code = ''; let msg = ''; let status = 0;
  try {
    await companyValidationService.validateInPerson(TENANT_ID, {
      company_id: companyId,
      validation_token: 'dummy',
      employee_id: '00000000-0000-0000-0000-000000000000',
    });
  } catch (e: any) {
    threw = true;
    code = e?.code ?? '';
    msg = e?.message ?? '';
    status = e?.statusCode ?? 0;
  }
  record('1 validateInPerson LANÇA erro', threw, `threw=${threw}`);
  record('2 erro tem code PJ_LEGACY_IN_PERSON_VERIFIED_DISABLED',
    code === 'PJ_LEGACY_IN_PERSON_VERIFIED_DISABLED' || /PJ_LEGACY_IN_PERSON_VERIFIED_DISABLED/.test(msg),
    `code=${code} msg=${msg}`);
  record('2b validateInPerson statusCode 501 (handler global emite 501, não 400)', status === 501, `status=${status}`);

  // Confirma no banco que nada foi escrito.
  const dbRow = await pool.query<{ company_status: string; is_verified: boolean }>(
    'SELECT company_status, is_verified FROM companies WHERE company_id=$1::uuid', [companyId]);
  record('3 banco: company_status=PROVISIONAL & is_verified=false (NÃO escreveu)',
    dbRow.rows[0].company_status === 'PROVISIONAL' && dbRow.rows[0].is_verified === false,
    `company_status=${dbRow.rows[0].company_status} is_verified=${dbRow.rows[0].is_verified}`);

  const cvCount = await pool.query<{ n: string }>(
    'SELECT count(*)::text n FROM company_validations WHERE company_id=$1::uuid', [companyId]
  ).then((r) => parseInt(r.rows[0].n, 10)).catch(() => -1);
  record('4 company_validations: 0 linhas (NÃO escreveu)', cvCount === 0, `rows=${cvCount}`);

  // DECISION-0096: requestValidation TAMBÉM desabilitado — LANÇA 501 ANTES de gerar token/QR.
  let rvThrew = false; let rvCode = ''; let rvStatus = 0; let rvLeakedToken = false;
  try {
    const vr = await companyValidationService.requestValidation(TENANT_ID, companyId);
    // Não deveria chegar aqui; se chegar, houve vazamento de token/QR órfão.
    rvLeakedToken = typeof vr?.qr_code_payload === 'string' && vr.qr_code_payload.length > 0;
  } catch (e: any) {
    rvThrew = true;
    rvCode = e?.code ?? '';
    rvStatus = e?.statusCode ?? 0;
  }
  record('5 requestValidation LANÇA e NÃO gera QR órfão', rvThrew && !rvLeakedToken, `threw=${rvThrew} leaked=${rvLeakedToken}`);
  record('5b requestValidation code PJ_PRESENTIAL_VALIDATION_RESERVED', rvCode === 'PJ_PRESENTIAL_VALIDATION_RESERVED', `code=${rvCode}`);
  record('5c requestValidation statusCode 501 (não 400)', rvStatus === 501, `status=${rvStatus}`);

  const bankAfter = await pool
    .query<{ n: string }>(`SELECT (COALESCE((SELECT count(*) FROM bank_ledger),0)+COALESCE((SELECT count(*) FROM bank_transactions),0))::text n`)
    .then((r) => parseInt(r.rows[0].n, 10)).catch(() => -1);
  record('6 zero Bank (ledger/transactions inalterados)', bankBefore === bankAfter, `before=${bankBefore} after=${bankAfter}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '✨' : '❌'} ${results.length - failed.length}/${results.length} verdes`);
  await pool.end();
  if (failed.length > 0) process.exit(1);
}

main().catch(async (e) => { console.error('FATAL', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
