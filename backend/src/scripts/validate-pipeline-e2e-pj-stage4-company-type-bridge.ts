/**
 * E2E F-PJ-STAGE4-COMPANY-TYPE-BRIDGE (Op1 / DECISÃO Clayton 2026-06-05).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-stage4-company-type-bridge-ephemeral.ps1.
 *
 * Prova: o Stage 4 (store-onboarding) deriva o company_type da EMPRESA CLASSIFICADA
 * (`companies.primary_company_type_id`), NÃO de `tenants.company_type_id`. A empresa VENCE o tenant;
 * `tenants.company_type_id` é só path legado (sem companyId). Sem classificação → null (sem fallback p/
 * tenant). Isolamento por tenant. Zero product_offers/Bank.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { storeOnboardingService } from '../modules/marketplace/store-onboarding.service';
import { tenantService } from '../core/tenants/tenant.service';
import { randomUUID } from 'crypto';

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
  if (!/stage4|bridge|company|onboarding|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

// acesso aos métodos privados da ponte (teste de unidade do source-selection).
const svc = storeOnboardingService as any;

async function main(): Promise<void> {
  await assertEphemeralDb();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Stage4 Bridge Test', slug: `stage4-bridge-${Date.now()}` });

  // 2 pares allowed distintos (supermercado, farmácia) — ids reais.
  const pairs = (await pool.query<{ ct: string; c: string; ct_slug: string }>(
    `SELECT ct.id::text AS ct, a.concept_id::text AS c, ct.slug AS ct_slug
       FROM company_type_allowed_concepts a JOIN company_types ct ON ct.id=a.company_type_id
      WHERE ct.slug IN ('supermercado','farmacia') ORDER BY ct.slug`
  )).rows;
  const farmacia = pairs.find((p) => p.ct_slug === 'farmacia')!;
  const supermercado = pairs.find((p) => p.ct_slug === 'supermercado')!;

  // Empresa CLASSIFICADA: primary_company_type_id=supermercado, primary_concept_id setado. tenant.company_type_id=NULL.
  const companyId = (await pool.query<{ c: string }>(
    `INSERT INTO companies (tenant_id, company_name, primary_company_type_id, primary_concept_id)
     VALUES ($1, 'Stage4 Super', $2::uuid, $3::uuid) RETURNING company_id::text AS c`,
    [TENANT_ID, supermercado.ct, supermercado.c]
  )).rows[0].c;

  const bankBefore = Number((await pool.query(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)).rows[0].n);
  const offersBefore = Number((await pool.query(`SELECT count(*)::int AS n FROM product_offers`)).rows[0].n);

  // ═══ 1 — com companyId → companies.primary_company_type_id (tenant null) ═══
  record('1 companyId → companies.primary_company_type_id (=supermercado)',
    (await svc.resolveStage4CompanyTypeId(TENANT_ID, companyId)) === supermercado.ct);
  record('1b sem companyId (legado) → tenants.company_type_id (=null aqui)',
    (await svc.resolveStage4CompanyTypeId(TENANT_ID, undefined)) === null);

  // ═══ 2 — popular tenants.company_type_id=farmacia: empresa AINDA vence ═══
  await pool.query(`UPDATE tenants SET company_type_id=$2::uuid WHERE id=$1`, [TENANT_ID, farmacia.ct]);
  record('2 empresa VENCE o tenant: companyId → supermercado (ignora tenants=farmacia)',
    (await svc.resolveStage4CompanyTypeId(TENANT_ID, companyId)) === supermercado.ct);
  record('2b legado (sem companyId) lê tenants=farmacia (compat preservado)',
    (await svc.resolveStage4CompanyTypeId(TENANT_ID, undefined)) === farmacia.ct);

  // ═══ 3 — audit context: company classificada → type+concept da empresa ═══
  const aud = await svc.loadTenantOnboardingAuditContext(TENANT_ID, companyId);
  record('3 audit context (companyId): companyType=supermercado + conceptId=primary_concept_id',
    aud.companyTypeId === supermercado.ct && Array.isArray(aud.conceptIds) && aud.conceptIds.length === 1 && aud.conceptIds[0] === supermercado.c,
    JSON.stringify(aud));

  // ═══ 4 — empresa NÃO classificada + companyId → null (sem fallback p/ tenant) ═══
  const unclassId = (await pool.query<{ c: string }>(
    `INSERT INTO companies (tenant_id, company_name) VALUES ($1,'Stage4 Unclass') RETURNING company_id::text AS c`, [TENANT_ID]
  )).rows[0].c;
  record('4 empresa não classificada + companyId → null (NÃO cai no tenant=farmacia)',
    (await svc.resolveStage4CompanyTypeId(TENANT_ID, unclassId)) === null);

  // ═══ 5 — isolamento por tenant: companyId de outro tenant → null ═══
  const OTHER_TENANT = randomUUID();
  await tenantService.createTenant({ id: OTHER_TENANT, name: 'Stage4 Other', slug: `stage4-other-${Date.now()}` });
  record('5 isolamento: companyId do tenant A consultado sob tenant B → null',
    (await svc.resolveStage4CompanyTypeId(OTHER_TENANT, companyId)) === null);

  // ═══ 6 — não-toque: tenants.company_type_id NÃO foi populado pela ponte; zero offers/Bank ═══
  // (a ponte só LÊ companies; o UPDATE no cenário 2 foi do teste, não da ponte.)
  record('6a nenhum product_offer criado pela ponte', Number((await pool.query(`SELECT count(*)::int AS n FROM product_offers`)).rows[0].n) === offersBefore);
  record('6b Bank intocado', Number((await pool.query(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)).rows[0].n) === bankBefore);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Ponte Stage 4 company_type (empresa classificada vence): verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
