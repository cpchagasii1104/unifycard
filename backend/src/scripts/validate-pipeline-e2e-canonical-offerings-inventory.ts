/**
 * E2E CP4 F-CANONICAL-CATALOG-BUSINESS-TEMPLATES-AND-OFFERING-CLOSURE — oferta
 * empresarial por variante canônica + inventory causal + oferta de serviço com
 * Unified Availability (DECISION-0117 A/D/H + fechamento da
 * DT-INVENTORY-PRODUCT-VISIBILITY-TENANT-WIDE-STOCK-PROJECTION), HTTP real.
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-canonical-offerings-ephemeral.ps1.
 *
 * Prova (GO §10.5):
 *   - duas empresas ativam a MESMA variante canônica (SKUs internos próprios,
 *     preços próprios, ofertas distintas — identidade nunca duplicada/copiada);
 *   - isolamento: A não altera oferta de B (403 + estado imutável);
 *   - estoque de A NÃO entra na oferta de B (projeção pública merchant-scoped);
 *   - unidade incompatível NÃO soma (movimento em kg fora da soma em un);
 *   - estoque zero → oferta permanece (linha viva) mas sai da lista pública;
 *   - pré-KYB/sem publicação → oferta NÃO aparece publicamente (defesa direta);
 *   - serviço canônico compartilhado: 2 prestadores, preços/durações/agendas
 *     diferentes; disponibilidade na Unified Availability (zero agenda paralela);
 *   - cross-provider → 403; zero Bank writer.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { rbacService } from '../core/rbac/rbac.service';
import { companiesModule } from '../core/companies/companies.module';
import authPlugin from '../core/auth/auth.plugin';
import { tenantPlugin } from '../plugins/tenant.plugin';
import { actionContextPlugin } from '../plugins/action-context.plugin';
import { rbacPlugin } from '../plugins/rbac.plugin';

dotenv.config({ path: join(process.cwd(), '.env') });

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const JWT_SECRET = process.env.JWT_SECRET;
const PDF = Buffer.from('%PDF-1.4\n%e2e canonical offerings\n%%EOF\n');

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!JWT_SECRET) throw new Error('ABORT: JWT_SECRET ausente.');
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function bootstrapSocialPorts(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  await app.register(authPlugin);
  await app.register(tenantPlugin);
  await app.register(actionContextPlugin);
  await app.register(rbacPlugin);
  await app.register(companiesModule, { prefix: '/companies' });
  const identityModule = (await import('../core/identity/identity.routes')).default;
  await app.register(identityModule, { prefix: '/identity' });
  const catalogGovernanceRoutes = (await import('../core/catalog/catalog-governance.routes')).default;
  await app.register(catalogGovernanceRoutes, { prefix: '/catalog/governance' });
  const marketplaceOfferingsRoutes = (await import('../modules/marketplace/marketplace-offerings.routes')).default;
  await app.register(marketplaceOfferingsRoutes, { prefix: '/marketplace' });
  const serviceOfferingsRoutes = (await import('../modules/services/service-offerings.routes')).default;
  await app.register(serviceOfferingsRoutes, { prefix: '/services' });
  await app.ready();
  return app;
}

function makeValidCnpj(seed: number): string {
  const base = String(seed).padStart(8, '0').slice(-8) + '0001';
  const calc = (nums: string): number => {
    const weights = nums.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = nums.split('').reduce((acc, d, i) => acc + parseInt(d, 10) * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(base);
  const d2 = calc(base + String(d1));
  return base + String(d1) + String(d2);
}

interface Human { globalId: string; userId: string; actorId: string; headers: Record<string, string> }

async function main(): Promise<void> {
  await assertEphemeralDb();
  await bootstrapSocialPorts();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Canonical Offerings Test', slug: `canonical-offerings-${Date.now()}` });
  await rbacService.seedDefaultRBAC(TENANT_ID);

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const actorRepo = socialPortsRegistry.getActorRepository();

  let cpfSeq = Date.now() % 100000000;
  const mkHuman = async (name: string, role?: 'admin'): Promise<Human> => {
    const globalId = randomUUID();
    const userId = randomUUID();
    const cpf = String(cpfSeq++).padStart(11, '0').slice(-11);
    await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,$3,'{}'::jsonb)`, [globalId, cpf, name]);
    await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [globalId, cpf]);
    await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`, [userId, TENANT_ID, globalId, `${userId}@e2e.local`]);
    const actorId = (await actorRepo.findOrCreateUserActor(TENANT_ID, userId)).actor_id;
    if (role === 'admin') await rbacService.assignRoleByName(TENANT_ID, userId, 'admin');
    const token = jwt.sign(
      { sub: userId, userId, tenantId: TENANT_ID, email: `${userId}@e2e.local`, tokenVersion: 0, globalUserId: globalId, type: 'access' },
      JWT_SECRET as string,
      { expiresIn: '15m' }
    );
    const ac = JSON.stringify({ actorId, intent: 'offerings_e2e', source: 'e2e', scope: `tenant:${TENANT_ID}` });
    return { globalId, userId, actorId, headers: { authorization: `Bearer ${token}`, 'x-action-context': ac } };
  };

  const F1 = await mkHuman('E2E Off Founder Super');
  const F2 = await mkHuman('E2E Off Founder Distrib');
  const F3 = await mkHuman('E2E Off Founder NoKyb');
  const P2 = await mkHuman('E2E Off Provider PF');
  const ADM = await mkHuman('E2E Off Curator', 'admin');

  const app = await buildApp();
  const seedBase = Date.now() % 90000000;

  const createCompany = async (h: Human, seed: number, name: string): Promise<{ companyId: string; pageActorId: string }> => {
    const r = await app.inject({
      method: 'POST', url: '/companies', headers: h.headers,
      payload: { cnpj: makeValidCnpj(seed), companyName: name, role: 'owner', fetchFromRevenue: false },
    });
    if (r.statusCode !== 201) throw new Error(`createCompany falhou: ${r.statusCode} ${r.body}`);
    const companyId = r.json().company.companyId as string;
    const pa = await pool.query<{ id: string }>(`SELECT id FROM actors WHERE company_id = $1::uuid LIMIT 1`, [companyId]);
    if (pa.rowCount === 0) throw new Error('page actor da empresa não nasceu');
    return { companyId, pageActorId: pa.rows[0].id };
  };

  const activate = async (h: Human, companyId: string, typeSlug: string): Promise<string> => {
    const pair = await pool.query<{ company_type_id: string; concept_id: string }>(
      `SELECT ac.company_type_id, ac.concept_id FROM company_type_allowed_concepts ac
         JOIN company_types ct ON ct.id = ac.company_type_id WHERE ct.slug = $1 LIMIT 1`,
      [typeSlug]
    );
    const r = await app.inject({
      method: 'POST', url: `/companies/${companyId}/operational-activation`, headers: h.headers,
      payload: { companyTypeId: pair.rows[0].company_type_id, conceptId: pair.rows[0].concept_id },
    });
    if (r.statusCode !== 200 && r.statusCode !== 201) throw new Error(`ativação falhou: ${r.statusCode} ${r.body}`);
    return pair.rows[0].concept_id;
  };

  const approveKybAndPublish = async (h: Human, companyId: string, conceptId: string): Promise<void> => {
    const { submitKybDocument } = await import('../core/kyb-documents/kyb-document-submit.service');
    const docIds: string[] = [];
    for (const documentType of ['cnpj_registration', 'articles_of_association']) {
      const d = await submitKybDocument({
        tenantId: TENANT_ID, companyId, globalUserId: h.globalId, userId: h.userId,
        documentType, buffer: PDF, mimeType: 'application/pdf', originalFilename: `${documentType}.pdf`,
      });
      docIds.push(d.documentId);
    }
    const req = await app.inject({ method: 'POST', url: `/companies/${companyId}/kyb/requests`, headers: h.headers, payload: {} });
    if (req.statusCode !== 201) throw new Error(`kyb request falhou: ${req.statusCode} ${req.body}`);
    const kybRequestId = req.json().data.kybRequestId as string;
    for (const docId of docIds) {
      const rv = await app.inject({
        method: 'PATCH', url: `/identity/pj/kyb/documents/${docId}/review`, headers: ADM.headers,
        payload: { decision: 'accepted', reason: 'e2e docs ok' },
      });
      if (rv.statusCode !== 200) throw new Error(`doc review falhou: ${rv.statusCode} ${rv.body}`);
    }
    const ap = await app.inject({
      method: 'PATCH', url: `/identity/pj/kyb/admin/requests/${kybRequestId}/review`, headers: ADM.headers,
      payload: { decision: 'approved', reason: 'e2e' },
    });
    if (ap.statusCode !== 200) throw new Error(`kyb approve falhou: ${ap.statusCode} ${ap.body}`);
    const pub = await app.inject({
      method: 'POST', url: `/companies/${companyId}/publications`, headers: h.headers,
      payload: { conceptId },
    });
    if (pub.statusCode !== 201 && pub.statusCode !== 200) throw new Error(`publicação falhou: ${pub.statusCode} ${pub.body}`);
  };

  const A = await createCompany(F1, seedBase + 11, 'E2E Off Supermercado');
  const B = await createCompany(F2, seedBase + 12, 'E2E Off Distribuidora');
  const C = await createCompany(F3, seedBase + 13, 'E2E Off SemKyb');
  const conceptA = await activate(F1, A.companyId, 'supermercado');
  const conceptB = await activate(F2, B.companyId, 'distribuidora-de-bebidas');
  await activate(F3, C.companyId, 'supermercado');
  await approveKybAndPublish(F1, A.companyId, conceptA);
  await approveKybAndPublish(F2, B.companyId, conceptB);
  // C fica SEM KYB/publicação de propósito (prova da defesa direta do reader).

  const CAT_BEBIDAS = (await pool.query<{ category_id: string }>(`SELECT category_id FROM categories WHERE slug='marketplace-bebidas' LIMIT 1`)).rows[0].category_id;
  const CONCEPT_COLA = (await pool.query<{ concept_id: string }>(`SELECT concept_id FROM concepts WHERE domain='item-comercial' AND slug='refrigerante-de-cola' LIMIT 1`)).rows[0].concept_id;

  const bank0 = await pool.query<{ n: string }>(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`);

  try {
    // Fundação: sugestão + variante + curadoria (caminho governado do CP1)
    const sug = await app.inject({
      method: 'POST', url: '/catalog/governance/products/suggestions', headers: F1.headers,
      payload: {
        companyId: A.companyId, name: 'Coca-Cola Original', brand: 'Coca-Cola', gtin: '7894900011517',
        categoryId: CAT_BEBIDAS,
        variant: { variantName: 'Coca-Cola Original 1L retornável', gtin: '7894900011524', netContentValue: 1, netContentUnit: 'l', packageType: 'garrafa', isReturnable: true },
      },
    });
    const cocaProductId = sug.json()?.data?.canonicalProductId as string;
    const cocaVariantId = sug.json()?.data?.variant?.id as string;
    const appr = await app.inject({
      method: 'POST', url: `/catalog/governance/curation/products/${cocaProductId}/approve`, headers: ADM.headers,
      payload: { conceptId: CONCEPT_COLA },
    });
    record('S0 fundação: sugestão+variante+curadoria verdes', sug.statusCode === 201 && !!cocaVariantId && appr.statusCode === 200, `sug=${sug.statusCode} appr=${appr.statusCode}`);

    // O1/O2 — DUAS empresas ativam a MESMA variante (ofertas próprias)
    const offerA = await app.inject({
      method: 'POST', url: '/marketplace/offerings/product', headers: F1.headers,
      payload: { storeActorId: A.pageActorId, companyId: A.companyId, canonicalVariantId: cocaVariantId, internalSku: 'SKU-SUPER-001', saleUnit: 'un', priceCents: 700 },
    });
    const offerB = await app.inject({
      method: 'POST', url: '/marketplace/offerings/product', headers: F2.headers,
      payload: { storeActorId: B.pageActorId, companyId: B.companyId, canonicalVariantId: cocaVariantId, internalSku: 'SKU-DIST-777', saleUnit: 'un', priceCents: 650 },
    });
    const oA = offerA.json()?.data; const oB = offerB.json()?.data;
    record('O1 A e B ativam a MESMA variante canônica (2 ofertas, 1 identidade)',
      offerA.statusCode === 201 && offerB.statusCode === 201 && oA?.canonicalVariantId === oB?.canonicalVariantId && oA?.offerId !== oB?.offerId,
      `A=${offerA.statusCode} B=${offerB.statusCode}`);
    record('O2 SKUs internos e preços PRÓPRIOS', oA?.internalSku === 'SKU-SUPER-001' && oB?.internalSku === 'SKU-DIST-777' && oA?.priceCents === 700 && oB?.priceCents === 650);
    const cpCount = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM canonical_products WHERE LOWER(name) LIKE 'coca-cola original%'`);
    record('O3 nenhuma identidade canônica duplicada pelas ofertas', cpCount.rows[0].n === '1', `n=${cpCount.rows[0].n}`);
    const again = await app.inject({
      method: 'POST', url: '/marketplace/offerings/product', headers: F1.headers,
      payload: { storeActorId: A.pageActorId, companyId: A.companyId, canonicalVariantId: cocaVariantId, internalSku: 'SKU-SUPER-001', saleUnit: 'un', priceCents: 700 },
    });
    record('O4 reativar é idempotente (mesma oferta)', again.statusCode === 200 && again.json()?.data?.offerId === oA?.offerId, `status=${again.statusCode}`);

    // O5 — ISOLAMENTO: A não altera a oferta de B (403 + imutável)
    const cross = await app.inject({
      method: 'PUT', url: `/marketplace/offerings/product/${oB.offerId}`, headers: F1.headers,
      payload: { priceCents: 1 },
    });
    const bPrice = await pool.query<{ price_cents: string }>(`SELECT price_cents FROM product_offers WHERE id=$1::uuid`, [oB.offerId]);
    record('O5 cross-merchant PUT → 403 + preço de B imutável',
      cross.statusCode === 403 && bPrice.rows[0].price_cents === '650', `status=${cross.statusCode} price=${bPrice.rows[0].price_cents}`);

    // O6 — estoque actor-scoped na projeção pública (estoque de A não entra em B)
    await pool.query(
      `INSERT INTO inventory_movements (tenant_id, product_variant_id, movement_type, quantity, unit, actor_id)
       VALUES ($1::uuid, $2::uuid, 'in', 10, 'un', $3::uuid)`,
      [TENANT_ID, oA.tenantVariantId, A.pageActorId]
    );
    await pool.query(
      `INSERT INTO inventory_movements (tenant_id, product_variant_id, movement_type, quantity, unit, actor_id)
       VALUES ($1::uuid, $2::uuid, 'in', 5, 'un', $3::uuid)`,
      [TENANT_ID, oB.tenantVariantId, B.pageActorId]
    );
    const { listVisibleProducts } = await import('../modules/marketplace/product-visibility.service');
    const vis1 = await listVisibleProducts(TENANT_ID);
    const vA = vis1.find((v) => v.offerId === oA.offerId);
    const vB = vis1.find((v) => v.offerId === oB.offerId);
    record('O6 projeção pública merchant-scoped (A=10, B=5; sem vazamento)',
      vA?.availableQuantity === 10 && vB?.availableQuantity === 5, `A=${vA?.availableQuantity} B=${vB?.availableQuantity}`);

    // O7 — unidade incompatível NÃO soma (kg fora da soma em un)
    await pool.query(
      `INSERT INTO inventory_movements (tenant_id, product_variant_id, movement_type, quantity, unit, actor_id)
       VALUES ($1::uuid, $2::uuid, 'in', 99, 'kg', $3::uuid)`,
      [TENANT_ID, oA.tenantVariantId, A.pageActorId]
    );
    const vis2 = await listVisibleProducts(TENANT_ID);
    const vA2 = vis2.find((v) => v.offerId === oA.offerId);
    record('O7 kg NÃO soma com un (base incompatível separada)', vA2?.availableQuantity === 10, `A=${vA2?.availableQuantity}`);

    // O8 — estoque zero: oferta PERMANECE, sai da lista pública
    await pool.query(
      `INSERT INTO inventory_movements (tenant_id, product_variant_id, movement_type, quantity, unit, actor_id)
       VALUES ($1::uuid, $2::uuid, 'out', 10, 'un', $3::uuid)`,
      [TENANT_ID, oA.tenantVariantId, A.pageActorId]
    );
    const vis3 = await listVisibleProducts(TENANT_ID);
    const offerRowA = await pool.query<{ status: string; is_active: boolean }>(`SELECT status, is_active FROM product_offers WHERE id=$1::uuid`, [oA.offerId]);
    record('O8 estoque zero → indisponível na lista, oferta viva no banco',
      !vis3.some((v) => v.offerId === oA.offerId) && vis3.some((v) => v.offerId === oB.offerId) &&
      offerRowA.rows[0].status === 'active', `rowA=${JSON.stringify(offerRowA.rows[0])}`);

    // O9 — pré-KYB/sem publicação NÃO aparece publicamente (defesa direta do reader)
    const offerC = await app.inject({
      method: 'POST', url: '/marketplace/offerings/product', headers: F3.headers,
      payload: { storeActorId: C.pageActorId, companyId: C.companyId, canonicalVariantId: cocaVariantId, internalSku: 'SKU-NOKYB-1', saleUnit: 'un', priceCents: 500 },
    });
    const oC = offerC.json()?.data;
    await pool.query(
      `INSERT INTO inventory_movements (tenant_id, product_variant_id, movement_type, quantity, unit, actor_id)
       VALUES ($1::uuid, $2::uuid, 'in', 50, 'un', $3::uuid)`,
      [TENANT_ID, oC.tenantVariantId, C.pageActorId]
    );
    const vis4 = await listVisibleProducts(TENANT_ID);
    record('O9 empresa sem KYB/publicação NÃO aparece na projeção pública (com estoque!)',
      offerC.statusCode === 201 && !vis4.some((v) => v.offerId === oC.offerId), `status=${offerC.statusCode}`);

    // O10 — SERVIÇO canônico compartilhado: 2 prestadores, preços/durações próprios
    const corte = await pool.query<{ id: string }>(`SELECT id FROM canonical_services WHERE scope='global' AND slug='corte-de-cabelo-masculino' LIMIT 1`);
    const so1 = await app.inject({
      method: 'POST', url: '/services/offerings', headers: P2.headers,
      payload: { providerActorId: P2.actorId, canonicalServiceId: corte.rows[0].id, priceCents: 3500, durationMinutes: 30 },
    });
    const so2 = await app.inject({
      method: 'POST', url: '/services/offerings', headers: F1.headers,
      payload: { providerActorId: A.pageActorId, companyId: A.companyId, canonicalServiceId: corte.rows[0].id, priceCents: 5000, durationMinutes: 45 },
    });
    const s1 = so1.json()?.data; const s2 = so2.json()?.data;
    record('O10 2 prestadores referenciam o MESMO serviço canônico (preço/duração próprios)',
      so1.statusCode === 201 && so2.statusCode === 201 && s1?.canonicalServiceId === s2?.canonicalServiceId &&
      s1?.priceCents === 3500 && s2?.priceCents === 5000 && s1?.durationMinutes === 30 && s2?.durationMinutes === 45,
      `so1=${so1.statusCode} so2=${so2.statusCode}`);
    const csCount = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM canonical_services WHERE slug='corte-de-cabelo-masculino'`);
    record('O11 significado NÃO duplicado por prestador (1 canônico)', csCount.rows[0].n === '1', `n=${csCount.rows[0].n}`);

    // O12 — agendas DIFERENTES na Unified Availability; ZERO agenda paralela
    const schedules0 = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM schedules WHERE tenant_id=$1`, [TENANT_ID]);
    const av1 = await app.inject({
      method: 'POST', url: `/services/offerings/${s1.id}/availability`, headers: P2.headers,
      payload: { startDatetime: '2026-07-01T09:00:00-03:00', endDatetime: '2026-07-01T12:00:00-03:00', capacity: 4 },
    });
    const av2 = await app.inject({
      method: 'POST', url: `/services/offerings/${s2.id}/availability`, headers: F1.headers,
      payload: { startDatetime: '2026-07-02T14:00:00-03:00', endDatetime: '2026-07-02T18:00:00-03:00', capacity: 2 },
    });
    const avRows = await pool.query<{ n: string }>(
      `SELECT count(*)::text n FROM availability WHERE tenant_id=$1 AND owner_type='service_offering'`, [TENANT_ID]);
    const schedules1 = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM schedules WHERE tenant_id=$1`, [TENANT_ID]);
    record('O12 disponibilidade na Unified Availability (2 janelas, owners distintos); zero agenda paralela',
      av1.statusCode === 201 && av2.statusCode === 201 && avRows.rows[0].n === '2' && schedules0.rows[0].n === schedules1.rows[0].n,
      `av=${avRows.rows[0].n} schedules=${schedules0.rows[0].n}→${schedules1.rows[0].n}`);

    // O13 — cross-provider → 403 (P2 não altera oferta da empresa A; F2 não altera a de P2)
    const crossSvc = await app.inject({
      method: 'PUT', url: `/services/offerings/${s1.id}`, headers: F2.headers,
      payload: { priceCents: 1 },
    });
    const s1Price = await pool.query<{ price_cents: string }>(`SELECT price_cents FROM service_offerings WHERE id=$1::uuid`, [s1.id]);
    record('O13 cross-provider PUT → 403 + preço imutável', crossSvc.statusCode === 403 && s1Price.rows[0].price_cents === '3500',
      `status=${crossSvc.statusCode} price=${s1Price.rows[0].price_cents}`);

    // O14 — variante: agrupamento por canônica nas ofertas vivas (B + C referenciam a MESMA)
    const distinctVariants = await pool.query<{ n: string }>(
      `SELECT count(DISTINCT canonical_variant_id)::text n FROM product_offers WHERE tenant_id=$1 AND canonical_variant_id IS NOT NULL`, [TENANT_ID]);
    record('O14 todas as ofertas referenciam 1 única variante canônica', distinctVariants.rows[0].n === '1', `n=${distinctVariants.rows[0].n}`);

    // O15 — zero Bank writer na jornada inteira
    const bank1 = await pool.query<{ n: string }>(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`);
    record('O15 zero Bank writer', bank0.rows[0].n === bank1.rows[0].n, `${bank0.rows[0].n} vs ${bank1.rows[0].n}`);
  } finally {
    await app.close();
    // blobs do KYB desta run (storage compartilhado com o dev) — limpeza best-effort
    try {
      const { resolveDocumentStorageProvider } = await import('../core/document-storage/document-storage.provider');
      const storage = resolveDocumentStorageProvider();
      const refs = await pool.query<{ file_reference: string }>(`SELECT file_reference FROM fiscal_identity_documents`);
      for (const ref of refs.rows) {
        try { await storage.deleteDocument(ref.file_reference); } catch { /* noop */ }
      }
    } catch { /* noop */ }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Ofertas empresariais por variante canônica + inventory causal — verde.');
  process.exit(0); // CLI validator: encerra o event loop (handles transitivas de módulos importados)
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
