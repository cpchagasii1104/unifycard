/**
 * E2E F-PJ-PRODUCT-OFFER-ELIGIBILITY-GUARD (DECISION-0108 na camada de OFERTA).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-product-offer-eligibility-guard-ephemeral.ps1.
 *
 * Prova-chave (a FRESTA fechada): num TENANT COMPARTILHADO, o supermercado materializa banana (hortifruti);
 * a farmácia no MESMO tenant tenta OFERTAR a banana já materializada — `getProductByCanonicalId` reusa o
 * `product` (o guard de MATERIALIZAÇÃO não roda) — MAS antes de criar a `product_offer` o guard por
 * categoria/ramo BARRA a farmácia (ForbiddenError). Resultado: zero product_offer indevida.
 * `companyId` presente → fail-closed; ausente (PF/legado) → bypass compat. Sem preço real → sem offer.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { storeOnboardingService } from '../modules/marketplace/store-onboarding.service';
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
  if (!/offer|eligibility|guard|onboarding|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const count = async (sql: string, params: unknown[] = []): Promise<number> =>
  Number((await pool.query(sql, params)).rows[0].n);

type Onb = { ok: boolean; offers: number; imported: number; forbidden: boolean; err?: string };
async function onboard(
  tenantId: string,
  input: Parameters<typeof storeOnboardingService.createStoreOnboarding>[1],
  importerId: string
): Promise<Onb> {
  try {
    const r = await storeOnboardingService.createStoreOnboarding(tenantId, input, importerId);
    return { ok: true, offers: r.createdOffersCount, imported: r.importedProductsCount, forbidden: false };
  } catch (e) {
    return { ok: false, offers: 0, imported: 0, forbidden: e instanceof ForbiddenError, err: e instanceof Error ? e.message : String(e) };
  }
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Offer Guard', slug: `offer-guard-${Date.now()}` });

  const ct = (await pool.query<{ id: string; slug: string; concept: string }>(
    `SELECT ct.id::text, ct.slug, a.concept_id::text AS concept FROM company_types ct
       JOIN company_type_allowed_concepts a ON a.company_type_id=ct.id WHERE ct.slug IN ('supermercado','farmacia')`
  )).rows;
  const superRow = ct.find((x) => x.slug === 'supermercado')!;
  const farmaRow = ct.find((x) => x.slug === 'farmacia')!;

  const cat = (await pool.query<{ slug: string; id: string }>(
    `SELECT slug, category_id::text AS id FROM categories
      WHERE slug IN ('marketplace-alimentacao','marketplace-hortifruti','marketplace-saude-beleza','marketplace-medicamentos-suplementos','marketplace-carnes-aves')`
  )).rows;
  const C = (s: string): string => cat.find((c) => c.slug === s)!.id;
  const alimentacao = C('marketplace-alimentacao');
  const hortifruti = C('marketplace-hortifruti');
  const saudeBeleza = C('marketplace-saude-beleza');
  const medicamentos = C('marketplace-medicamentos-suplementos');
  const carnes = C('marketplace-carnes-aves');

  // identidade humana → actor humano (importer/responsável E merchant PF no cenário D)
  const gu = randomUUID();
  await pool.query(
    `INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`,
    [gu, String(Date.now()).padStart(11, '0').slice(-11)]
  );
  const humanId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, global_user_id) VALUES ($1,'user','Dono',$2::uuid) RETURNING id::text AS id`,
    [TENANT_ID, gu]
  )).rows[0].id;

  const mkCompany = async (name: string, ctId: string, concept: string): Promise<string> =>
    (await pool.query<{ c: string }>(
      `INSERT INTO companies (tenant_id, company_name, primary_company_type_id, primary_concept_id) VALUES ($1,$2,$3::uuid,$4::uuid) RETURNING company_id::text AS c`,
      [TENANT_ID, name, ctId, concept]
    )).rows[0].c;
  const mkStore = async (name: string, companyId: string): Promise<string> =>
    (await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id) VALUES ($1,'page',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [TENANT_ID, name, companyId, humanId]
    )).rows[0].id;

  // TENANT COMPARTILHADO (o coração do teste): super, super2 e farmácia coexistem no mesmo tenant.
  const companySuper = await mkCompany('Super', superRow.id, superRow.concept);
  const companySuper2 = await mkCompany('Super2', superRow.id, superRow.concept);
  const companyFarma = await mkCompany('Farma', farmaRow.id, farmaRow.concept);
  const storeSuper = await mkStore('Loja Super', companySuper);
  const storeSuper2 = await mkStore('Loja Super2', companySuper2);
  const storeFarma = await mkStore('Loja Farma', companyFarma);

  // tenants.company_type_id NÃO é setado (fica NULL) → no cenário D (sem companyId) o guard bypassa (compat);
  // nos cenários com companyId, a empresa é a única fonte (prova que o tenant NÃO é autoridade).

  const canonBefore = await count(`SELECT count(*)::int AS n FROM canonical_products`);
  const ctacBefore = await count(`SELECT count(*)::int AS n FROM company_type_allowed_concepts`);
  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  // ═══ A — supermercado MATERIALIZA e OFERTA banana (hortifruti ∈ ramos), preço real ═══
  const a = await onboard(TENANT_ID, { actorId: storeSuper, companyId: companySuper, departmentCategoryId: alimentacao, selectedCategoryIds: [hortifruti], hasOwnProducts: false, defaultSalePrice: 4.5 }, humanId);
  record('A supermercado materializa+oferta banana (offers = importados > 0)', a.ok && a.offers === a.imported && a.offers > 0, JSON.stringify(a));
  const aPrice = await count(`SELECT count(*)::int AS n FROM product_offers WHERE tenant_id=$1 AND merchant_id=$2 AND price_cents=450`, [TENANT_ID, storeSuper]);
  record('A offers com preço REAL (price_cents=450)', aPrice === a.offers && aPrice > 0, `p450=${aPrice}`);
  const bananaProducts = await count(`SELECT count(*)::int AS n FROM products WHERE tenant_id=$1 AND category_id=$2`, [TENANT_ID, hortifruti]);
  record('A banana MATERIALIZADA no tenant (products de hortifruti existem)', bananaProducts > 0, `prod=${bananaProducts}`);

  // ═══ B — PROVA-CHAVE: farmácia REUSA a banana materializada, mas o guard de OFERTA barra ═══
  const b = await onboard(TENANT_ID, { actorId: storeFarma, companyId: companyFarma, departmentCategoryId: alimentacao, selectedCategoryIds: [hortifruti], hasOwnProducts: false, defaultSalePrice: 3 }, humanId);
  record('B FRESTA FECHADA: farmácia + banana REUSADA → guard de OFERTA barra (ForbiddenError)', b.forbidden, b.err);
  const farmaOffers = await count(`SELECT count(*)::int AS n FROM product_offers WHERE tenant_id=$1 AND merchant_id=$2`, [TENANT_ID, storeFarma]);
  record('B zero product_offer indevida para a farmácia', farmaOffers === 0, `offers=${farmaOffers}`);
  // a banana continua materializada (foi do super) — a fresta era na OFERTA, não na materialização
  record('B banana segue materializada (a barreira foi na prateleira, não no depósito)', (await count(`SELECT count(*)::int AS n FROM products WHERE tenant_id=$1 AND category_id=$2`, [TENANT_ID, hortifruti])) === bananaProducts);

  // ═══ C — farmácia OFERTA item do SEU ramo (medicamentos) → OK ═══
  const c = await onboard(TENANT_ID, { actorId: storeFarma, companyId: companyFarma, departmentCategoryId: saudeBeleza, selectedCategoryIds: [medicamentos], hasOwnProducts: false, defaultSalePrice: 2 }, humanId);
  record('C farmácia oferta item do seu ramo (medicamentos) → OK, offers > 0', c.ok && c.offers > 0, JSON.stringify(c));

  // ═══ D — PF SEM companyId → bypass compat (sem company não há ramo); oferta a banana reusada ═══
  const d = await onboard(TENANT_ID, { actorId: humanId, departmentCategoryId: alimentacao, selectedCategoryIds: [hortifruti], hasOwnProducts: false, defaultSalePrice: 1 }, humanId);
  record('D PF sem companyId → bypass compat (não lança), oferta criada', d.ok && d.offers > 0, JSON.stringify(d));

  // ═══ E — supermercado2 SEM preço real → produto na prateleira, ZERO offer (Op2 preservado) ═══
  const e = await onboard(TENANT_ID, { actorId: storeSuper2, companyId: companySuper2, departmentCategoryId: alimentacao, selectedCategoryIds: [carnes], hasOwnProducts: false }, humanId);
  record('E sem preço real → products materializados, ZERO offers', e.ok && e.offers === 0 && e.imported > 0, JSON.stringify(e));

  // ═══ F — não-toque ═══
  record('F1 nenhuma offer com price_cents=0 fabricada em todo o tenant', (await count(`SELECT count(*)::int AS n FROM product_offers WHERE tenant_id=$1 AND price_cents=0`, [TENANT_ID])) === 0);
  record('F2 nenhum canonical_product novo', (await count(`SELECT count(*)::int AS n FROM canonical_products`)) === canonBefore);
  record('F3 company_type_allowed_concepts intocado', (await count(`SELECT count(*)::int AS n FROM company_type_allowed_concepts`)) === ctacBefore);
  record('F4 tenants.company_type_id NÃO populado (segue NULL; empresa é a única autoridade)',
    (await pool.query<{ t: string | null }>(`SELECT company_type_id::text AS t FROM tenants WHERE id=$1`, [TENANT_ID])).rows[0].t === null);
  record('F5 Bank intocado', (await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)) === bankBefore);

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
  console.log('✨ Guard de elegibilidade na camada de oferta: fresta do reuso fechada — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
