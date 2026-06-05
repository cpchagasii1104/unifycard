/**
 * E2E F-PJ-PRODUCT-CONCEPT-GUARD-LAYER-FIX (DECISION-0108).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-product-concept-guard-layer-fix-ephemeral.ps1.
 *
 * Prova: o guard de produto governa por CATEGORIA/RAMO pré-moldado do company_type (régua certa),
 * NÃO por igualdade concept item-comercial × concept vendor (régua errada que a 0105 invalidou).
 * Fonte do company_type = empresa CLASSIFICADA (companies.primary_company_type_id); tenant só legado.
 * "Trocar a régua errada, não desligar a segurança": supermercado materializa itens dos seus ramos;
 * farmácia NÃO materializa banana (hortifruti ∉ ramos da farmácia); fail-closed por categoria fora do recorte.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { productCatalogService } from '../modules/marketplace/product-catalog.service';
import { assertProductCategoryAllowedForCompany } from '../modules/marketplace/product-concept-guard';
import { ForbiddenError } from '../core/errors';
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
  if (!/guard|product|concept|layer|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

/** true se o guard PASSOU (não lançou); false se lançou ForbiddenError. Re-lança outros erros. */
async function guardPasses(tenantId: string, canonicalId: string | null, companyId?: string | null): Promise<boolean> {
  try {
    await assertProductCategoryAllowedForCompany(tenantId, canonicalId, companyId);
    return true;
  } catch (e) {
    if (e instanceof ForbiddenError) return false;
    throw e;
  }
}

async function createPasses(
  tenantId: string,
  canonicalId: string,
  categoryId: string,
  companyId: string | null
): Promise<{ ok: boolean; productId?: string }> {
  try {
    const p = await productCatalogService.createProduct(tenantId, {
      name: `e2e-${canonicalId.slice(0, 8)}`,
      categoryId,
      canonicalProductId: canonicalId,
      companyId,
      productType: 'industrial',
      isActive: true,
    });
    return { ok: true, productId: p.id };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false };
    throw e;
  }
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Guard Layer Fix', slug: `guard-layerfix-${Date.now()}` });

  // company_types reais + ids
  // company_types + um concept allowed (para satisfazer chk_companies_primary_classification_paired:
  // primary_company_type_id e primary_concept_id são setados juntos — o concept é a ativação operacional).
  const ct = (await pool.query<{ id: string; slug: string; concept: string }>(
    `SELECT ct.id::text, ct.slug, a.concept_id::text AS concept
       FROM company_types ct JOIN company_type_allowed_concepts a ON a.company_type_id=ct.id
      WHERE ct.slug IN ('supermercado','farmacia')`
  )).rows;
  const superRow = ct.find((x) => x.slug === 'supermercado')!;
  const farmaRow = ct.find((x) => x.slug === 'farmacia')!;
  const superCt = superRow.id;
  const farmaCt = farmaRow.id;

  // canônicos reais: banana (hortifruti, ramo SUPERMERCADO) e analgésico (medicamentos, ramo FARMÁCIA)
  const banana = (await pool.query<{ id: string; cat: string; concept: string }>(
    `SELECT cp.id::text, cp.category_id::text AS cat, cp.concept_id::text AS concept
       FROM canonical_products cp JOIN categories c ON c.category_id=cp.category_id
      WHERE c.slug='marketplace-hortifruti' AND cp.type='INDUSTRIAL' AND cp.concept_id IS NOT NULL
      ORDER BY cp.name LIMIT 1`
  )).rows[0];
  const remedio = (await pool.query<{ id: string; cat: string }>(
    `SELECT cp.id::text, cp.category_id::text AS cat
       FROM canonical_products cp JOIN categories c ON c.category_id=cp.category_id
      WHERE c.slug='marketplace-medicamentos-suplementos' AND cp.type='INDUSTRIAL'
      ORDER BY cp.name LIMIT 1`
  )).rows[0];
  if (!banana || !remedio) throw new Error('Seed inesperado: faltam canônicos de hortifruti/medicamentos.');

  // empresas CLASSIFICADAS (companies.primary_company_type_id)
  const companySuper = (await pool.query<{ c: string }>(
    `INSERT INTO companies (tenant_id, company_name, primary_company_type_id, primary_concept_id) VALUES ($1,'Super',$2::uuid,$3::uuid) RETURNING company_id::text AS c`,
    [TENANT_ID, superCt, superRow.concept]
  )).rows[0].c;
  const companyFarma = (await pool.query<{ c: string }>(
    `INSERT INTO companies (tenant_id, company_name, primary_company_type_id, primary_concept_id) VALUES ($1,'Farma',$2::uuid,$3::uuid) RETURNING company_id::text AS c`,
    [TENANT_ID, farmaCt, farmaRow.concept]
  )).rows[0].c;
  const companyUnclass = (await pool.query<{ c: string }>(
    `INSERT INTO companies (tenant_id, company_name) VALUES ($1,'Unclass') RETURNING company_id::text AS c`,
    [TENANT_ID]
  )).rows[0].c;

  const bankCount = async (): Promise<number> =>
    Number((await pool.query(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)).rows[0].n);
  const offerCount = async (): Promise<number> =>
    Number((await pool.query(`SELECT count(*)::int AS n FROM product_offers`)).rows[0].n);
  const bankBefore = await bankCount();
  const offersBefore = await offerCount();

  // ═══ 4 (prova-chave) — o guard NÃO compara item-comercial × vendor ═══
  // banana é item-comercial e seu concept NÃO está na allowlist vendor do supermercado → guard ANTIGO rejeitaria.
  const superVendor = (await pool.query<{ ac: string[] | null }>(
    `SELECT array_agg(a.concept_id::text) AS ac FROM company_type_allowed_concepts a WHERE a.company_type_id=$1::uuid`,
    [superCt]
  )).rows[0].ac ?? [];
  record('4a banana é item-comercial e seu concept NÃO está na allowlist vendor do supermercado (régua antiga rejeitaria)',
    !superVendor.includes(banana.concept), `vendor=${JSON.stringify(superVendor)} banana.concept=${banana.concept}`);

  // ═══ 1 — supermercado MATERIALIZA item do seu ramo (banana ∈ hortifruti) — e2e real ═══
  const c1 = await createPasses(TENANT_ID, banana.id, banana.cat, companySuper);
  const persisted = c1.productId
    ? Number((await pool.query(`SELECT count(*)::int AS n FROM products WHERE id=$1 AND tenant_id=$2`, [c1.productId, TENANT_ID])).rows[0].n) === 1
    : false;
  record('1 supermercado materializa banana (hortifruti ∈ ramos) — createProduct OK + products persistido', c1.ok && persisted, JSON.stringify(c1));

  // ═══ 4b — confirmação via guard direto: supermercado + banana PASSA (régua nova) ═══
  record('4b guard direto: supermercado + banana PASSA (governa por categoria/ramo, não vendor concept)',
    await guardPasses(TENANT_ID, banana.id, companySuper));

  // ═══ 2 / 3 — farmácia NÃO materializa banana (hortifruti ∉ ramos da farmácia) — fail-closed ═══
  record('3a guard direto: farmácia + banana REJEITA (hortifruti fora do recorte da farmácia)',
    !(await guardPasses(TENANT_ID, banana.id, companyFarma)));
  const c3 = await createPasses(TENANT_ID, banana.id, banana.cat, companyFarma);
  const notPersisted = Number((await pool.query(
    `SELECT count(*)::int AS n FROM products WHERE tenant_id=$1 AND canonical_product_id=$2`,
    [TENANT_ID, banana.id]
  )).rows[0].n) === 1; // só o do supermercado (cenário 1); farmácia NÃO criou outro
  record('3b createProduct farmácia+banana REJEITADO (ForbiddenError) e NÃO persistiu produto novo', !c3.ok && notPersisted, JSON.stringify(c3));

  // ═══ 2b — farmácia materializa item do SEU ramo (analgésico ∈ medicamentos) ═══
  record('2b guard direto: farmácia + analgésico PASSA (medicamentos ∈ ramos da farmácia)',
    await guardPasses(TENANT_ID, remedio.id, companyFarma));

  // ═══ 6 — tenants.company_type_id NÃO é autoridade no fluxo PJ novo ═══
  // tenant classificado SUPERMERCADO, mas company CLASSIFICADA farmácia + banana → empresa VENCE → REJEITA.
  await pool.query(`UPDATE tenants SET company_type_id=$2::uuid WHERE id=$1`, [TENANT_ID, superCt]);
  record('6a empresa VENCE tenant: companyId=farmácia + banana REJEITA mesmo com tenants=supermercado',
    !(await guardPasses(TENANT_ID, banana.id, companyFarma)));
  // legado (sem companyId) lê tenant=supermercado → banana PASSA (compat preservado)
  record('6b legado (sem companyId) lê tenants=supermercado → banana PASSA (compat)',
    await guardPasses(TENANT_ID, banana.id, undefined));

  // ═══ 5 — marketplace-templates não quebra: produto SEM canônico → bypass (não lança) ═══
  record('5 sem canonicalProductId (ex.: templates) → bypass, não lança', await guardPasses(TENANT_ID, null, companySuper));

  // ═══ 7 — compat documentado: empresa não classificada → sem company_type → bypass (não lança) ═══
  record('7a empresa não classificada (primary_company_type_id null) → bypass compat (não lança)',
    await guardPasses(TENANT_ID, banana.id, companyUnclass));
  // canônico sem categoria não existe no seed; cobrimos canônico inexistente → bypass
  record('7b canônico inexistente → bypass (deixa FK falhar adiante), não lança',
    await guardPasses(TENANT_ID, randomUUID(), companySuper));

  // ═══ 8 — não-toque: zero product_offers pela cadeia do guard; Bank intocado ═══
  record('8a nenhum product_offer criado (guard/createProduct não tocam offers)', (await offerCount()) === offersBefore);
  record('8b Bank intocado', (await bankCount()) === bankBefore);

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
  console.log('✨ Guard por categoria/ramo (DECISION-0108): régua trocada, segurança preservada — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
