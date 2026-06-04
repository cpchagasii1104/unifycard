/**
 * E2E FASE 3.3-B2 — drop de companies.is_verified (DECISION-0097 + DECISION-0093 §4.3).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-is-verified-drop-ephemeral.ps1 (cria DB, migra FULL, roda, dropa).
 *
 * Prova (após migration 20260604130000):
 *   - companies.is_verified NÃO existe mais (information_schema);
 *   - INSERT de company SEM is_verified funciona (coluna não é mais requisito);
 *   - o CHECK lifecycle de company_status segue bloqueando VERIFIED/APPROVED (23514);
 *   - fiscal_identities.kyb_status segue intacto (verificação fiscal); verified_at não existe;
 *   - is_verified não ressuscita.
 *
 * Tudo em UMA transação num client dedicado, ROLLBACK final (nada persiste).
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';

const TENANT_ID = '44444444-2222-3333-4444-bbbbbbbbbbbb';
const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — esta validação NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/is.?verified|drop|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function colExists(table: string, col: string): Promise<boolean> {
  const r = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text n FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
    [table, col]
  );
  return parseInt(r.rows[0].n, 10) > 0;
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  // 1. coluna companies.is_verified AUSENTE
  record('1 companies.is_verified DROPADA (ausente)', !(await colExists('companies', 'is_verified')));
  // 2. verified_at nunca existiu
  record('2 companies.verified_at ausente (ghost)', !(await colExists('companies', 'verified_at')));
  // 3. fiscal_identities.kyb_status intacto (verificação fiscal)
  record('3 fiscal_identities.kyb_status intacto', await colExists('fiscal_identities', 'kyb_status'));
  // 4. CHECK lifecycle de company_status ainda existe
  const chk = await pool.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='chk_companies_company_status_lifecycle'`
  );
  record('4 CHECK chk_companies_company_status_lifecycle existe', (chk.rowCount ?? 0) === 1);

  // tenant mínimo (commit próprio)
  if ((await pool.query('SELECT id FROM tenants WHERE id=$1', [TENANT_ID])).rowCount === 0) {
    await tenantService.createTenant({ id: TENANT_ID, name: 'PJ is_verified drop Test', slug: 'pj-is-verified-drop-test' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 5. INSERT de company SEM is_verified funciona (coluna não é requisito)
    let insOk = true; let insReason = '';
    let companyId = '';
    try {
      const ins = await client.query<{ company_id: string }>(
        `INSERT INTO companies (tenant_id, company_name, company_status) VALUES ($1,'Razao DropTest','PROVISIONAL') RETURNING company_id::text`,
        [TENANT_ID]
      );
      companyId = ins.rows[0].company_id;
    } catch (e: any) { insOk = false; insReason = e?.message ?? e?.code; }
    record('5 INSERT company sem is_verified funciona', insOk, insReason);

    // 6. INSERT referenciando is_verified FALHA (coluna não existe — prova o drop)
    await client.query('SAVEPOINT sp6');
    let droppedRefFails = false; let code6 = '';
    try {
      await client.query(`INSERT INTO companies (tenant_id, company_name, is_verified) VALUES ($1,'X',false)`, [TENANT_ID]);
    } catch (e: any) { droppedRefFails = true; code6 = e?.code ?? ''; }
    await client.query('ROLLBACK TO SAVEPOINT sp6');
    record('6 referência a is_verified FALHA (42703 undefined_column)', droppedRefFails && code6 === '42703', `code=${code6}`);

    // 7. CHECK lifecycle ainda bloqueia VERIFIED (segunda-verdade não ressuscita por company_status)
    await client.query('SAVEPOINT sp7');
    let verifiedBlocked = false; let code7 = '';
    try {
      await client.query(`UPDATE companies SET company_status='VERIFIED' WHERE company_id=$1::uuid`, [companyId]);
    } catch (e: any) { verifiedBlocked = true; code7 = e?.code ?? ''; }
    await client.query('ROLLBACK TO SAVEPOINT sp7');
    record('7 company_status=VERIFIED ainda BLOQUEADO (CHECK 23514)', verifiedBlocked && code7 === '23514', `code=${code7}`);

    await client.query('ROLLBACK');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* noop */ }
    throw e;
  } finally {
    client.release();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '✨' : '❌'} ${results.length - failed.length}/${results.length} verdes`);
  await pool.end();
  if (failed.length > 0) process.exit(1);
}

main().catch(async (e) => { console.error('FATAL', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
