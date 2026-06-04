/**
 * E2E FASE 3.3-A — companies.company_status preso no lifecycle (DECISION-0097 D3/D4 + SELO).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-company-status-lifecycle-ephemeral.ps1 (cria DB, migra FULL, roda, dropa).
 *
 * Prova o CHECK `chk_companies_company_status_lifecycle` (migration 20260604120000):
 *   - permite lifecycle DRAFT/PROVISIONAL/ACTIVE/SUSPENDED;
 *   - BLOQUEIA VERIFIED e APPROVED (23514) — verificação fiscal NÃO mora em company_status;
 *   - a normalização legada VERIFIED/APPROVED → ACTIVE funciona (com constraint solta, simula não-zero);
 *   - fiscal_identities.kyb_status intacto como verificação fiscal; is_verified NÃO é tocado.
 *
 * Tudo roda em UMA transação num client dedicado, com ROLLBACK final (nada persiste).
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';

const TENANT_ID = '55555555-3333-4444-5555-cccccccccccc';
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
  if (!/company.?status|lifecycle|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  // tenant mínimo (commit próprio, fora da transação de teste)
  if ((await pool.query('SELECT id FROM tenants WHERE id=$1', [TENANT_ID])).rowCount === 0) {
    await tenantService.createTenant({ id: TENANT_ID, name: 'PJ company_status lifecycle Test', slug: 'pj-company-status-lifecycle-test' });
  }

  const client = await pool.connect();
  /** Probe esperando violação de CHECK (23514), isolado em savepoint. */
  const expectViolation = async (sql: string, params: any[]): Promise<{ blocked: boolean; code: string }> => {
    await client.query('SAVEPOINT sp');
    try {
      await client.query(sql, params);
      await client.query('RELEASE SAVEPOINT sp');
      return { blocked: false, code: '' };
    } catch (e: any) {
      await client.query('ROLLBACK TO SAVEPOINT sp');
      return { blocked: e?.code === '23514', code: e?.code ?? '' };
    }
  };

  try {
    await client.query('BEGIN');

    // 0. CHECK existe + definição correta
    const conDef = await client.query<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='companies'::regclass AND conname='chk_companies_company_status_lifecycle'`
    );
    record('0 CHECK chk_companies_company_status_lifecycle existe', (conDef.rowCount ?? 0) === 1, `rows=${conDef.rowCount}`);
    const def = conDef.rows[0]?.def ?? '';
    record('0b def inclui DRAFT/PROVISIONAL/ACTIVE/SUSPENDED e NÃO VERIFIED/APPROVED',
      /DRAFT/.test(def) && /PROVISIONAL/.test(def) && /ACTIVE/.test(def) && /SUSPENDED/.test(def) && !/VERIFIED/.test(def) && !/APPROVED/.test(def),
      def);

    // company base com lifecycle ACTIVE (permitido)
    const insRes = await client.query<{ company_id: string }>(
      `INSERT INTO companies (tenant_id, company_name, company_status) VALUES ($1,'Razao Lifecycle','ACTIVE') RETURNING company_id::text`,
      [TENANT_ID]
    );
    const companyId = insRes.rows[0].company_id;
    record('1 INSERT company_status=ACTIVE permitido', true);

    // 2. lifecycle permitidos via UPDATE
    for (const v of ['DRAFT', 'PROVISIONAL', 'SUSPENDED', 'ACTIVE']) {
      await client.query('SAVEPOINT spv');
      let ok = true; let reason = '';
      try { await client.query(`UPDATE companies SET company_status=$1 WHERE company_id=$2::uuid`, [v, companyId]); }
      catch (e: any) { ok = false; reason = e?.code ?? e?.message; }
      await client.query('RELEASE SAVEPOINT spv');
      record(`2 lifecycle '${v}' permitido`, ok, reason);
    }

    // 3/4/5. ghosts e arbitrário bloqueados
    const v1 = await expectViolation(`UPDATE companies SET company_status='VERIFIED' WHERE company_id=$1::uuid`, [companyId]);
    record('3 VERIFIED BLOQUEADO (CHECK 23514)', v1.blocked, `code=${v1.code}`);
    const v2 = await expectViolation(`UPDATE companies SET company_status='APPROVED' WHERE company_id=$1::uuid`, [companyId]);
    record('4 APPROVED BLOQUEADO (CHECK 23514)', v2.blocked, `code=${v2.code}`);
    const v3 = await expectViolation(`UPDATE companies SET company_status='WHATEVER' WHERE company_id=$1::uuid`, [companyId]);
    record('5 valor desconhecido BLOQUEADO (CHECK 23514)', v3.blocked, `code=${v3.code}`);

    // 6. normalização legada VERIFIED/APPROVED → ACTIVE (constraint solta = simula ambiente não-zero)
    await client.query('SAVEPOINT spn');
    await client.query('ALTER TABLE companies DROP CONSTRAINT chk_companies_company_status_lifecycle');
    await client.query(`UPDATE companies SET company_status='VERIFIED' WHERE company_id=$1::uuid`, [companyId]);
    await client.query(`UPDATE companies SET company_status='ACTIVE' WHERE company_status IN ('VERIFIED','APPROVED')`); // mesma lógica da migration
    const after = await client.query<{ cs: string }>(`SELECT company_status AS cs FROM companies WHERE company_id=$1::uuid`, [companyId]);
    record('6 normalização VERIFIED→ACTIVE funciona', after.rows[0].cs === 'ACTIVE', `cs=${after.rows[0].cs}`);
    await client.query('ROLLBACK TO SAVEPOINT spn'); // restaura constraint + estado
    await client.query('RELEASE SAVEPOINT spn');

    // 7/8. fiscal_identities.kyb_status intacto + is_verified DROPADO (3.3-B2)
    const kyb = await client.query<{ n: string }>(`SELECT COUNT(*)::text n FROM information_schema.columns WHERE table_name='fiscal_identities' AND column_name='kyb_status'`);
    record('7 fiscal_identities.kyb_status intacto (verificação fiscal)', parseInt(kyb.rows[0].n, 10) === 1);
    const iv = await client.query<{ n: string }>(`SELECT COUNT(*)::text n FROM information_schema.columns WHERE table_name='companies' AND column_name='is_verified'`);
    record('8 is_verified DROPADO (Fase 3.3-B2 — coluna ausente)', parseInt(iv.rows[0].n, 10) === 0);

    await client.query('ROLLBACK'); // nada persiste
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
