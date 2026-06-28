/**
 * E2E — F-PRODUCT-OFFER-DIRECT-HTTP-E2E-PROOF.
 *
 * Prova de RUNTIME do endpoint DIRETO `POST /marketplace/offerings/product`
 * (`product-offering.service.activateVariantAndCreateOffer`), pela camada HTTP real
 * (Fastify `app.inject`), fechando o warning da YALA (o gêmeo `store-onboarding` já tinha
 * E2E runtime; o endpoint direto só tinha guard estático). Money-free; zero mudança de regra.
 *
 * Exercita, sobre o MESMO tenant compartilhado:
 *   A  PF/user (actor_type='user') publica produto              → 403 PRODUCT_PUBLISH_PJ_ONLY (DECISION-0155), zero offer.
 *   B  PF/user + companyId de empresa (crachá)                  → 403 PRODUCT_PUBLISH_PJ_ONLY (PJ-only barra ANTES do mismatch), zero offer.
 *   C  PJ page-company, ramo compatível (super × banana)        → 201 created, merchant_id = store, companyId DERIVADO (não body).
 *   D  PJ page + companyId de OUTRA empresa                     → 403 OFFER_COMPANY_MISMATCH (W1), zero offer.
 *   E  PJ page OMITE companyId, ramo compatível (super × tomate)→ 201 created (usa companyId derivado; omissão não bypassa).
 *   F  PJ fora do ramo (farma × banana), companyId omitido      → 403 DECISION-0108 (guard de ramo sobre a empresa DERIVADA), zero offer.
 *   G  dinheiro intocado                                        → Δ(bank_ledger+bank_transactions) = 0.
 *
 * Não reabre W1/W2: companyId continua derivado server-side do actor representado; o gate
 * só restringe QUEM publica (PJ-only) e por QUE ramo (DECISION-0108). Sem checkout/order/payment.
 *
 * 🔒 DB EFÊMERA (wrapper run-product-offer-direct-http-ephemeral.ps1).
 *    Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { randomUUID } from 'crypto';
dotenv.config({ path: join(process.cwd(), '.env') });

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { pool } from '../core/database/pool';

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
  if (!/offer|product|http|guard|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const count = async (sql: string, p: unknown[] = []): Promise<number> =>
  Number((await pool.query<{ n: string }>(sql, p)).rows[0].n);

interface Fixture {
  tenantId: string;
  userId: string;       // users.id (= user_id), principal autenticado (req.user.userId)
  pfActorId: string;    // actor_type='user' do próprio user (self-representável)
  storeSuper: string;   // page-actor da empresa supermercado (ramo inclui hortifruti)
  storeFarma: string;   // page-actor da empresa farmácia (ramo NÃO inclui hortifruti)
  companySuper: string;
  companyFarma: string;
  bananaVariantId: string; // canonical_variant (hortifruti) — compatível com super, fora do ramo da farma
  tomateVariantId: string; // canonical_variant (hortifruti) — para o cenário E (segundo item)
  bananaCpId: string;
}

async function seedFixture(seed: number): Promise<Fixture> {
  const tenantId = randomUUID();
  const globalUserId = randomUUID();
  const userId = randomUUID();
  const cpf = String(10000000000 + (seed % 89999999999)).padStart(11, '0').slice(-11);

  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3)`, [tenantId, `e2e-prodoffer-${seed}`, `e2e-prodoffer-${seed}`]);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1,$2)`, [globalUserId, cpf]);
  await pool.query(
    `INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','basic')`,
    [globalUserId, cpf]
  );
  // users.id = users.user_id = principal — consistente com canRepresentActor (actors.user_id === userId)
  // e resolveGlobalUserId (users WHERE id = userId).
  await pool.query(
    `INSERT INTO users (id, user_id, tenant_id, email, password_hash, global_user_id) VALUES ($1,$1,$2,$3,'x',$4)`,
    [userId, tenantId, `e2e-prodoffer-${seed}@e2e.local`, globalUserId]
  );

  // Actor humano PF do próprio user → self-representável (Path 1 de canRepresentActor).
  const pfActorId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id)
     VALUES ($1,'user','Dono PF',$2,$3::uuid) RETURNING id::text AS id`,
    [tenantId, userId, globalUserId]
  )).rows[0].id;

  // company_types pré-moldados (seed FULL): supermercado (inclui hortifruti) e farmácia (não inclui).
  const ct = (await pool.query<{ id: string; slug: string; concept: string }>(
    `SELECT ct.id::text, ct.slug, a.concept_id::text AS concept FROM company_types ct
       JOIN company_type_allowed_concepts a ON a.company_type_id=ct.id WHERE ct.slug IN ('supermercado','farmacia')`
  )).rows;
  const superRow = ct.find((x) => x.slug === 'supermercado')!;
  const farmaRow = ct.find((x) => x.slug === 'farmacia')!;

  const mkCompany = async (name: string, ctId: string, concept: string): Promise<string> =>
    (await pool.query<{ c: string }>(
      `INSERT INTO companies (tenant_id, company_name, primary_company_type_id, primary_concept_id)
       VALUES ($1,$2,$3::uuid,$4::uuid) RETURNING company_id::text AS c`,
      [tenantId, name, ctId, concept]
    )).rows[0].c;
  const mkStore = async (name: string, companyId: string): Promise<string> =>
    (await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id)
       VALUES ($1,'page',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, companyId, pfActorId]
    )).rows[0].id;

  const companySuper = await mkCompany('Super', superRow.id, superRow.concept);
  const companyFarma = await mkCompany('Farma', farmaRow.id, farmaRow.concept);
  const storeSuper = await mkStore('Loja Super', companySuper);
  const storeFarma = await mkStore('Loja Farma', companyFarma);

  // O user é OWNER das duas empresas → canRepresentActor(page) via canManageCompany (role='owner').
  for (const companyId of [companySuper, companyFarma]) {
    await pool.query(
      `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active, member_status)
       VALUES ($1,$2::uuid,$3::uuid,'owner',true,true,'active')`,
      [tenantId, companyId, globalUserId]
    );
  }

  // Variantes canônicas sobre canonical_products GLOBAIS confirmados (seed FULL), ambos hortifruti.
  const cpByName = async (name: string): Promise<{ id: string; category_id: string }> => {
    const row = (await pool.query<{ id: string; category_id: string }>(
      `SELECT id::text, category_id::text FROM canonical_products
        WHERE scope='global' AND tenant_id IS NULL AND concept_resolution_status='confirmed' AND name=$1 LIMIT 1`,
      [name]
    )).rows[0];
    if (!row) throw new Error(`canonical_product global "${name}" ausente no seed FULL`);
    return row;
  };
  const banana = await cpByName('Banana-prata');
  const tomate = await cpByName('Tomate comum');

  const mkVariant = async (cpId: string, vname: string, fp: string): Promise<string> =>
    (await pool.query<{ id: string }>(
      `INSERT INTO canonical_variants (canonical_product_id, variant_name, fingerprint_v1, status)
       VALUES ($1::uuid,$2,$3,'active') RETURNING id::text AS id`,
      [cpId, vname, fp]
    )).rows[0].id;
  const bananaVariantId = await mkVariant(banana.id, 'Banana-prata 1un', `fp-banana-${seed}`);
  const tomateVariantId = await mkVariant(tomate.id, 'Tomate comum 1un', `fp-tomate-${seed}`);

  return {
    tenantId, userId, pfActorId, storeSuper, storeFarma, companySuper, companyFarma,
    bananaVariantId, tomateVariantId, bananaCpId: banana.id,
  };
}

async function buildApp(fx: Fixture): Promise<FastifyInstance> {
  // canRepresentActor / actor-writer usam socialPortsRegistry — injetar adapters (como no bootstrap).
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const sa = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(sa.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(sa.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(sa.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(sa.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(sa.eventFeedHandlersAdapter);

  const app = Fastify({ logger: false });
  await app.register(sensible);
  // Erros AppError/HttpError (ex.: ForbiddenError do guard de ramo) carregam statusCode/code → mapeia fiel.
  app.setErrorHandler((err, _req, reply) => {
    const sc = Number.isInteger((err as { statusCode?: number }).statusCode)
      ? (err as { statusCode: number }).statusCode : 500;
    reply.status(sc).send({ ok: false, code: (err as { code?: string }).code ?? 'ERROR', message: err.message });
  });
  const offeringRoutes = (await import('../modules/marketplace/marketplace-offerings.routes')).default;
  await app.register(async (scope) => {
    scope.decorateRequest('user', null);
    scope.decorateRequest('tenant', null);
    scope.addHook('preHandler', async (req) => {
      (req as { user?: unknown }).user = { id: fx.userId, userId: fx.userId, tenantId: fx.tenantId };
      (req as { tenant?: unknown }).tenant = { id: fx.tenantId };
    });
    await scope.register(offeringRoutes, { prefix: '/marketplace' });
  });
  await app.ready();
  return app;
}

const HDR = { 'content-type': 'application/json' };

async function main(): Promise<void> {
  await assertEphemeralDb();
  const base = Math.floor(Math.random() * 90000000) + 10000000;
  const fx = await seedFixture(base);
  const app = await buildApp(fx);

  const bankTable = async (t: string): Promise<boolean> =>
    (await count(`SELECT count(*)::text n FROM information_schema.tables WHERE table_name=$1`, [t])) === 1;
  const lExists = await bankTable('bank_ledger');
  const txExists = await bankTable('bank_transactions');
  const bankBefore =
    (lExists ? await count(`SELECT count(*)::text n FROM bank_ledger`) : 0) +
    (txExists ? await count(`SELECT count(*)::text n FROM bank_transactions`) : 0);

  const offer = (storeActorId: string, companyId: string | null, canonicalVariantId: string, sku: string) =>
    app.inject({
      method: 'POST', url: '/marketplace/offerings/product', headers: HDR,
      payload: JSON.stringify({
        storeActorId, companyId, canonicalVariantId, internalSku: sku,
        saleUnit: 'un', priceCents: 450, availableQuantity: 10,
      }),
    });
  const offersOf = (merchantId: string): Promise<number> =>
    count(`SELECT count(*)::int AS n FROM product_offers WHERE tenant_id=$1 AND merchant_id=$2`, [fx.tenantId, merchantId]);

  try {
    // ═══ A — PF/user publica produto → 403 PRODUCT_PUBLISH_PJ_ONLY, zero offer ═══
    const a = await offer(fx.pfActorId, null, fx.bananaVariantId, `SKU-A-${base}`);
    const ba = JSON.parse(a.body);
    record('A PF/user → 403 PRODUCT_PUBLISH_PJ_ONLY (DECISION-0155)',
      a.statusCode === 403 && ba.code === 'PRODUCT_PUBLISH_PJ_ONLY', `status=${a.statusCode} body=${a.body.slice(0, 160)}`);
    record('A PF/user cria ZERO product_offer', (await offersOf(fx.pfActorId)) === 0);

    // ═══ B — PF/user + companyId de empresa (crachá) → PJ-only barra ANTES do mismatch, zero offer ═══
    const b = await offer(fx.pfActorId, fx.companySuper, fx.bananaVariantId, `SKU-B-${base}`);
    const bb = JSON.parse(b.body);
    record('B PF/user + companyId PJ → 403 PRODUCT_PUBLISH_PJ_ONLY (PJ-only barra antes do crachá)',
      b.statusCode === 403 && bb.code === 'PRODUCT_PUBLISH_PJ_ONLY', `status=${b.statusCode} code=${bb.code}`);
    record('B PF/user cria ZERO product_offer (mesmo enviando crachá)', (await offersOf(fx.pfActorId)) === 0);

    // ═══ C — PJ page (super) + ramo compatível (banana∈hortifruti) → 201 created ═══
    const c = await offer(fx.storeSuper, fx.companySuper, fx.bananaVariantId, `SKU-C-BANANA-${base}`);
    const bc = c.statusCode === 201 ? JSON.parse(c.body) : null;
    record('C PJ page-company ramo compatível → 201 created',
      c.statusCode === 201 && bc?.ok === true && bc?.created === true, `status=${c.statusCode} body=${c.body.slice(0, 160)}`);
    record('C oferta gravada com merchant_id = store (super) e canônico = banana',
      bc?.data?.canonicalProductId === fx.bananaCpId &&
      (await count(`SELECT count(*)::int AS n FROM product_offers WHERE tenant_id=$1 AND merchant_id=$2 AND id=$3::uuid`,
        [fx.tenantId, fx.storeSuper, bc?.data?.offerId])) === 1,
      `cp=${bc?.data?.canonicalProductId}`);
    record('C preço REAL na oferta (price_cents=450) e nenhuma offer de PF',
      (await count(`SELECT count(*)::int AS n FROM product_offers WHERE tenant_id=$1 AND merchant_id=$2 AND price_cents=450`,
        [fx.tenantId, fx.storeSuper])) === 1 && (await offersOf(fx.pfActorId)) === 0);

    // ═══ D — PJ page (super) + companyId de OUTRA empresa (farma) → 403 OFFER_COMPANY_MISMATCH ═══
    const supBeforeD = await offersOf(fx.storeSuper);
    const d = await offer(fx.storeSuper, fx.companyFarma, fx.tomateVariantId, `SKU-D-${base}`);
    const bd = JSON.parse(d.body);
    record('D PJ page + companyId de OUTRA empresa → 403 OFFER_COMPANY_MISMATCH (W1)',
      d.statusCode === 403 && bd.code === 'OFFER_COMPANY_MISMATCH', `status=${d.statusCode} code=${bd.code}`);
    record('D crachá alheio não fabrica offer (contagem do super inalterada)', (await offersOf(fx.storeSuper)) === supBeforeD);

    // ═══ E — PJ page (super) OMITE companyId, ramo compatível → 201 created (usa derivado, não bypassa) ═══
    const e = await offer(fx.storeSuper, null, fx.tomateVariantId, `SKU-E-TOMATE-${base}`);
    const be = e.statusCode === 201 ? JSON.parse(e.body) : null;
    record('E PJ page OMITE companyId, ramo compatível → 201 created (companyId derivado server-side)',
      e.statusCode === 201 && be?.created === true, `status=${e.statusCode} body=${e.body.slice(0, 160)}`);
    record('E offer do tomate gravada no merchant correto (super)',
      (await count(`SELECT count(*)::int AS n FROM product_offers WHERE tenant_id=$1 AND merchant_id=$2 AND canonical_variant_id=$3::uuid`,
        [fx.tenantId, fx.storeSuper, fx.tomateVariantId])) === 1);

    // ═══ F — PJ fora do ramo (farma × banana), companyId omitido → 403 DECISION-0108, zero offer ═══
    const f = await offer(fx.storeFarma, null, fx.bananaVariantId, `SKU-F-${base}`);
    const bf = JSON.parse(f.body);
    record('F PJ fora do ramo (farma × banana) → 403 (guard de ramo sobre a empresa DERIVADA)',
      f.statusCode === 403 && /DECISION-0108/.test(bf.message ?? ''), `status=${f.statusCode} body=${f.body.slice(0, 160)}`);
    record('F farmácia cria ZERO product_offer (omissão não vira bypass)', (await offersOf(fx.storeFarma)) === 0);

    // ═══ G — dinheiro intocado ═══
    const bankAfter =
      (lExists ? await count(`SELECT count(*)::text n FROM bank_ledger`) : 0) +
      (txExists ? await count(`SELECT count(*)::text n FROM bank_transactions`) : 0);
    record('G dinheiro intocado: Δ(bank_ledger+bank_transactions) = 0', bankAfter === bankBefore, `${bankBefore}->${bankAfter}`);
    record('G nenhuma offer com price_cents=0 fabricada no tenant',
      (await count(`SELECT count(*)::int AS n FROM product_offers WHERE tenant_id=$1 AND price_cents=0`, [fx.tenantId])) === 0);
  } finally {
    await app.close();
  }

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
  console.log('✨ Endpoint direto POST /marketplace/offerings/product: gates PJ-only + ramo + W1 provados em runtime HTTP.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
