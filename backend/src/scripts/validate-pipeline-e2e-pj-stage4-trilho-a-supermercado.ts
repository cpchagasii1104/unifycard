/**
 * E2E F-PJ-STAGE4-TRILHO-A-SUPERMERCADO (Op2 / DECISION-0108 + Op1).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-stage4-trilho-a-supermercado-ephemeral.ps1.
 *
 * Prova o caller vivo do Stage 4 ponta a ponta: `createStoreOnboarding` recebe `companyId`, deriva o
 * company_type da EMPRESA CLASSIFICADA (`companies.primary_company_type_id`) — vencendo `tenants.company_type_id`
 * divergente — materializa `products` dos RAMOS do supermercado via guard por categoria, e cria `product_offers`
 * APENAS quando há FONTE REAL de preço (`defaultSalePrice`). Sem preço: produto nasce na prateleira, ZERO offer
 * fabricada. Farmácia NÃO materializa banana (hortifruti fora do recorte). Sem canônico novo, sem product duplicado,
 * sem popular tenants, sem tocar company_type_allowed_concepts, Bank intocado.
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
  if (!/trilho|supermercado|stage4|onboarding|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const count = async (sql: string, params: unknown[] = []): Promise<number> =>
  Number((await pool.query(sql, params)).rows[0].n);

async function main(): Promise<void> {
  await assertEphemeralDb();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Trilho A Super', slug: `trilho-a-${Date.now()}` });

  // company_types + concept allowed (par para satisfazer chk_companies_primary_classification_paired)
  const ct = (await pool.query<{ id: string; slug: string; concept: string }>(
    `SELECT ct.id::text, ct.slug, a.concept_id::text AS concept
       FROM company_types ct JOIN company_type_allowed_concepts a ON a.company_type_id=ct.id
      WHERE ct.slug IN ('supermercado','farmacia')`
  )).rows;
  const superRow = ct.find((x) => x.slug === 'supermercado')!;
  const farmaRow = ct.find((x) => x.slug === 'farmacia')!;

  // categorias-chave (department supermercado + ramo hortifruti)
  const cat = (await pool.query<{ slug: string; id: string }>(
    `SELECT slug, category_id::text AS id FROM categories
      WHERE slug IN ('marketplace-alimentacao','marketplace-hortifruti')`
  )).rows;
  const alimentacao = cat.find((c) => c.slug === 'marketplace-alimentacao')!.id;
  const hortifruti = cat.find((c) => c.slug === 'marketplace-hortifruti')!.id;

  // identidade humana (DECISION-0062 identity-before-actor) → actor humano (importer/responsável).
  // actors.global_user_id → identities.global_user_id (fk_actor_identity).
  const gu = randomUUID();
  const cpf = String(Date.now()).padStart(11, '0').slice(-11);
  await pool.query(
    `INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level)
     VALUES ($1::uuid, $2, 'cpf', 'approved', 'basic')`,
    [gu, cpf]
  );
  const humanId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, global_user_id) VALUES ($1,'user','Dono',$2::uuid) RETURNING id::text AS id`,
    [TENANT_ID, gu]
  )).rows[0].id;

  // empresas CLASSIFICADAS + page-actors (lojas) com responsável humano
  const mkCompany = async (name: string, ctId: string, concept: string): Promise<string> =>
    (await pool.query<{ c: string }>(
      `INSERT INTO companies (tenant_id, company_name, primary_company_type_id, primary_concept_id)
       VALUES ($1,$2,$3::uuid,$4::uuid) RETURNING company_id::text AS c`,
      [TENANT_ID, name, ctId, concept]
    )).rows[0].c;
  const mkStore = async (name: string, companyId: string): Promise<string> =>
    (await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id)
       VALUES ($1,'page',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [TENANT_ID, name, companyId, humanId]
    )).rows[0].id;

  // duas empresas supermercado (uma page-actor por empresa — uq_actors_company_page); a farmácia roda
  // num tenant PRÓPRIO no cenário 3 (em produção tenant≈empresa).
  const companySuper = await mkCompany('Super 1', superRow.id, superRow.concept);
  const companySuper2 = await mkCompany('Super 2', superRow.id, superRow.concept);
  const storeSuper1 = await mkStore('Loja Super 1', companySuper);
  const storeSuper2 = await mkStore('Loja Super 2', companySuper2);

  // tenant DIVERGENTE (farmácia) — a empresa (supermercado) deve vencer
  await pool.query(`UPDATE tenants SET company_type_id=$2::uuid WHERE id=$1`, [TENANT_ID, farmaRow.id]);

  const canonBefore = await count(`SELECT count(*)::int AS n FROM canonical_products`);
  const ctacBefore = await count(`SELECT count(*)::int AS n FROM company_type_allowed_concepts`);
  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
  // o onboarding materializa apenas os RAMOS (default_branch_slugs / selectedCategoryIds), NÃO o department.
  const SUPER_BRANCH_SLUGS = ['marketplace-hortifruti', 'marketplace-carnes-aves', 'marketplace-mercearia',
    'marketplace-bebidas', 'marketplace-limpeza', 'marketplace-padaria-confeitaria'];
  const superBranchCanon = await count(
    `SELECT count(*)::int AS n FROM canonical_products cp JOIN categories c ON c.category_id=cp.category_id
      WHERE c.slug = ANY($1::text[]) AND cp.type='INDUSTRIAL'`,
    [SUPER_BRANCH_SLUGS]
  );

  // ═══ 1 — COM preço: deriva da empresa (super) mesmo com tenant=farmácia; materializa + cria offers ═══
  const r1 = await storeOnboardingService.createStoreOnboarding(
    TENANT_ID,
    { actorId: storeSuper1, companyId: companySuper, hasOwnProducts: false, defaultSalePrice: 4.5, defaultStock: 7 },
    humanId
  );
  record('1a empresa VENCE tenant=farmácia: materializa ramos do SUPERMERCADO (importedProductsCount = canônicos super)',
    r1.importedProductsCount === superBranchCanon && superBranchCanon > 0, `imported=${r1.importedProductsCount} superCanon=${superBranchCanon}`);
  record('1b COM defaultSalePrice → offers criadas (createdOffersCount = importados)',
    r1.createdOffersCount === r1.importedProductsCount && r1.createdOffersCount > 0, JSON.stringify({ off: r1.createdOffersCount }));
  const offersPriceOk = await count(
    `SELECT count(*)::int AS n FROM product_offers WHERE tenant_id=$1 AND merchant_id=$2 AND price_cents=450`,
    [TENANT_ID, storeSuper1]
  );
  record('1c offers usam o PREÇO REAL (price_cents=450), não fabricado', offersPriceOk === r1.createdOffersCount, `price450=${offersPriceOk}`);
  const productsAfter1 = await count(`SELECT count(*)::int AS n FROM products WHERE tenant_id=$1`, [TENANT_ID]);
  record('1d products materializados = canônicos do super', productsAfter1 === superBranchCanon, `products=${productsAfter1}`);
  // nenhum product fora dos ramos do super
  const outOfBranch = await count(
    `SELECT count(*)::int AS n FROM products p JOIN categories c ON c.category_id=p.category_id
      WHERE p.tenant_id=$1 AND c.slug <> ALL($2::text[])`,
    [TENANT_ID, SUPER_BRANCH_SLUGS]
  );
  record('1e nenhum product fora dos ramos pré-moldados do supermercado', outOfBranch === 0, `fora=${outOfBranch}`);

  // ═══ 2 — SEM preço: produto nasce na prateleira (reuso), ZERO offer fabricada ═══
  const r2 = await storeOnboardingService.createStoreOnboarding(
    TENANT_ID,
    { actorId: storeSuper2, companyId: companySuper2, hasOwnProducts: false }, // 2ª empresa super, sem defaultSalePrice
    humanId
  );
  record('2a SEM preço: ZERO offers fabricadas (createdOffersCount=0)', r2.createdOffersCount === 0, `off=${r2.createdOffersCount}`);
  const offersStore2 = await count(`SELECT count(*)::int AS n FROM product_offers WHERE tenant_id=$1 AND merchant_id=$2`, [TENANT_ID, storeSuper2]);
  record('2b nenhuma product_offer persistida para a loja sem preço', offersStore2 === 0);
  const productsAfter2 = await count(`SELECT count(*)::int AS n FROM products WHERE tenant_id=$1`, [TENANT_ID]);
  record('2c products REUSADOS (sem duplicar): contagem inalterada vs cenário 1', productsAfter2 === productsAfter1, `p1=${productsAfter1} p2=${productsAfter2}`);
  // não há price_cents=0 fabricado em lugar nenhum
  const fakeZero = await count(`SELECT count(*)::int AS n FROM product_offers WHERE tenant_id=$1 AND price_cents=0`, [TENANT_ID]);
  record('2d nenhuma offer com price_cents=0 (etiqueta fabricada) em todo o tenant', fakeZero === 0, `zero=${fakeZero}`);

  // ═══ 3 — Farmácia NÃO materializa banana pelo caminho governado (hortifruti ∉ ramos da farmácia) ═══
  // Tenant PRÓPRIO (em produção tenant≈empresa): banana NÃO foi pré-materializada pelo super → o guard roda
  // no createProduct (não há reuso de products que pularia o guard).
  const TENANT_FARMA = randomUUID();
  await tenantService.createTenant({ id: TENANT_FARMA, name: 'Trilho A Farma', slug: `trilho-a-farma-${Date.now()}` });
  const guF = randomUUID();
  await pool.query(
    `INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`,
    [guF, String(Date.now() + 1).padStart(11, '0').slice(-11)]
  );
  const humanF = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, global_user_id) VALUES ($1,'user','DonoF',$2::uuid) RETURNING id::text AS id`,
    [TENANT_FARMA, guF]
  )).rows[0].id;
  const companyFarmaT = (await pool.query<{ c: string }>(
    `INSERT INTO companies (tenant_id, company_name, primary_company_type_id, primary_concept_id) VALUES ($1,'FarmaT',$2::uuid,$3::uuid) RETURNING company_id::text AS c`,
    [TENANT_FARMA, farmaRow.id, farmaRow.concept]
  )).rows[0].c;
  const storeFarmaT = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id) VALUES ($1,'page','Loja Farma',$2::uuid,$3::uuid) RETURNING id::text AS id`,
    [TENANT_FARMA, companyFarmaT, humanF]
  )).rows[0].id;
  // categoria hortifruti é global; resolvemos o id no contexto do tenant da farmácia (mesma tabela global).
  let farmaThrew = false;
  let farmaErr = '';
  try {
    await storeOnboardingService.createStoreOnboarding(
      TENANT_FARMA,
      { actorId: storeFarmaT, companyId: companyFarmaT, departmentCategoryId: alimentacao, selectedCategoryIds: [hortifruti], hasOwnProducts: false, defaultSalePrice: 3 },
      humanF
    );
  } catch (e) {
    farmaThrew = e instanceof ForbiddenError;
    farmaErr = e instanceof Error ? `${(e as { code?: string }).code ?? ''} ${e.message}` : String(e);
  }
  record('3 farmácia + hortifruti (banana) REJEITADO pelo guard (ForbiddenError) — tenant próprio', farmaThrew, farmaErr);
  const bananaForFarma = await count(
    `SELECT count(*)::int AS n FROM product_offers WHERE tenant_id=$1`, [TENANT_FARMA]
  );
  record('3b farmácia não criou nenhuma offer (tenant próprio)', bananaForFarma === 0);
  const farmaProducts = await count(`SELECT count(*)::int AS n FROM products WHERE tenant_id=$1`, [TENANT_FARMA]);
  record('3c farmácia não materializou nenhum product de hortifruti', farmaProducts === 0, `prod=${farmaProducts}`);

  // ═══ 4 — não-toque: zero canônico novo; allowed_concepts intocado; tenants não populado; Bank intocado ═══
  record('4a nenhum canonical_product novo criado', (await count(`SELECT count(*)::int AS n FROM canonical_products`)) === canonBefore);
  record('4b company_type_allowed_concepts intocado', (await count(`SELECT count(*)::int AS n FROM company_type_allowed_concepts`)) === ctacBefore);
  record('4c tenants.company_type_id NÃO populado pelo fluxo (segue farmácia que o teste setou)',
    (await pool.query<{ t: string | null }>(`SELECT company_type_id::text AS t FROM tenants WHERE id=$1`, [TENANT_ID])).rows[0].t === farmaRow.id);
  record('4d Bank intocado', (await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)) === bankBefore);

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
  console.log('✨ Trilho A supermercado: ponte ponta a ponta + offer só com preço real — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
