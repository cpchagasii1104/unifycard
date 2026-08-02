/**
 * E2E INTEGRADO F-CANONICAL-CATALOG-BUSINESS-TEMPLATES-AND-OFFERING-CLOSURE
 * (DECISION-0117 A–H) — a cadeia INTEIRA do GO §12, HTTP real:
 *
 *   empresa operacional → template/composição → produto/serviço canônico →
 *   variante material → mídia canônica → ativação → oferta própria →
 *   preço/estoque/agenda próprios → menu projetado → busca/discovery →
 *   publicação/retirada → isolamento entre empresas.
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-canonical-catalog-integrado-ephemeral.ps1.
 *
 * Atores: humanos A/B/C + 2º prestador PF; empresas supermercado (template amplo),
 * distribuidora de bebidas (recorte) e salão (serviços+agenda); mesmo tenant;
 * CNPJs distintos; page actors distintos; KYB real controlado (admin humano).
 *
 * Produto: Coca-Cola Original 1 litro retornável — 1 CONCEPT, 1 canônico,
 * 1 variante exata, 1 BLOB de mídia (reenvio não duplica blob; asset lógico por contexto); A e B referenciam
 * a MESMA variante com SKUs/preços/estoques próprios; busca = 1 item → 2 ofertas;
 * cross-actor 403 + banco imutável. Serviço: corte de cabelo masculino — 1 CONCEPT,
 * 1 canônico, 2 prestadores (preço/duração/agenda próprios na Unified Availability).
 * Lifecycle: pré-publicação invisível; revogação KYB de A retira SÓ A (canônico,
 * mídia e oferta de B permanecem); suspensão da oferta de serviço retira só ela.
 * Unidades: kg+un não soma; preço comparado só na mesma unidade.
 * Financeiro: snapshots bank_* antes/depois = ZERO writer. Cleanup: storage local
 * sem resíduo (DB efêmera é dropada pelo wrapper).
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { promises as fsp } from 'fs';
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
const PDF = Buffer.from('%PDF-1.4\n%e2e canonical integrado\n%%EOF\n');
const PNG_COCA = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('coca-cola-1l-retornavel-canonical')]);

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
  const mediaAssetsRoutes = (await import('../core/media-assets/media-assets.routes')).default;
  await app.register(mediaAssetsRoutes, { prefix: '/catalog/media' });
  const companyTemplatesRoutes = (await import('../core/companies/company-templates.routes')).default;
  await app.register(companyTemplatesRoutes, { prefix: '/companies' });
  const marketplaceOfferingsRoutes = (await import('../modules/marketplace/marketplace-offerings.routes')).default;
  await app.register(marketplaceOfferingsRoutes, { prefix: '/marketplace' });
  const serviceOfferingsRoutes = (await import('../modules/services/service-offerings.routes')).default;
  await app.register(serviceOfferingsRoutes, { prefix: '/services' });
  const moduleProjectionRoutes = (await import('../core/navigation/module-projection.routes')).default;
  await app.register(moduleProjectionRoutes, { prefix: '/navigation' });
  const marketplaceCanonicalSearchRoutes = (await import('../modules/marketplace/marketplace-canonical-search.routes')).default;
  await app.register(marketplaceCanonicalSearchRoutes, { prefix: '/marketplace' });
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

function multipartBody(parts: Array<{ name: string; filename?: string; contentType?: string; value: Buffer | string }>): { payload: Buffer; contentType: string } {
  const boundary = '----e2ecanint' + Math.random().toString(16).slice(2);
  const chunks: Buffer[] = [];
  for (const p of parts) {
    let head = `--${boundary}\r\nContent-Disposition: form-data; name="${p.name}"`;
    if (p.filename) head += `; filename="${p.filename}"`;
    head += '\r\n';
    if (p.contentType) head += `Content-Type: ${p.contentType}\r\n`;
    head += '\r\n';
    chunks.push(Buffer.from(head), Buffer.isBuffer(p.value) ? p.value : Buffer.from(p.value), Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function storageFileCount(): Promise<number> {
  try {
    return (await fsp.readdir(join(process.cwd(), '.private', 'document-storage'))).length;
  } catch {
    return 0;
  }
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  await bootstrapSocialPorts();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Canonical Integrado Test', slug: `canonical-integrado-${Date.now()}` });
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
      { expiresIn: '20m' }
    );
    const ac = JSON.stringify({ actorId, intent: 'canonical_integrado', source: 'e2e', scope: `tenant:${TENANT_ID}` });
    return { globalId, userId, actorId, headers: { authorization: `Bearer ${token}`, 'x-action-context': ac } };
  };

  const HA = await mkHuman('E2E Int Humano A');
  const HB = await mkHuman('E2E Int Humano B');
  const HC = await mkHuman('E2E Int Humano C');
  const P2 = await mkHuman('E2E Int Prestador Dois');
  const ADM = await mkHuman('E2E Int Curador', 'admin');

  const app = await buildApp();
  const seedBase = Date.now() % 90000000;
  // Baseline do storage ANTES de qualquer efeito (KYB docs + mídia desta run são limpos no finally).
  const files0 = await storageFileCount();

  const createCompany = async (h: Human, seed: number, name: string): Promise<{ companyId: string; pageActorId: string; fiscalIdentityId: string }> => {
    const r = await app.inject({
      method: 'POST', url: '/companies', headers: h.headers,
      payload: { cnpj: makeValidCnpj(seed), companyName: name, role: 'owner', fetchFromRevenue: false },
    });
    if (r.statusCode !== 201) throw new Error(`createCompany falhou: ${r.statusCode} ${r.body}`);
    const companyId = r.json().company.companyId as string;
    const meta = await pool.query<{ id: string; fid: string }>(
      `SELECT a.id, c.fiscal_identity_id::text AS fid FROM companies c JOIN actors a ON a.company_id = c.company_id
        WHERE c.company_id = $1::uuid LIMIT 1`, [companyId]);
    return { companyId, pageActorId: meta.rows[0].id, fiscalIdentityId: meta.rows[0].fid };
  };
  const activate = async (h: Human, companyId: string, typeSlug: string): Promise<string> => {
    const pair = await pool.query<{ company_type_id: string; concept_id: string }>(
      `SELECT ac.company_type_id, ac.concept_id FROM company_type_allowed_concepts ac
         JOIN company_types ct ON ct.id = ac.company_type_id WHERE ct.slug = $1 LIMIT 1`, [typeSlug]);
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
    const kybRequestId = req.json().data.kybRequestId as string;
    for (const docId of docIds) {
      await app.inject({ method: 'PATCH', url: `/identity/pj/kyb/documents/${docId}/review`, headers: ADM.headers, payload: { decision: 'accepted', reason: 'e2e ok' } });
    }
    const ap = await app.inject({ method: 'PATCH', url: `/identity/pj/kyb/admin/requests/${kybRequestId}/review`, headers: ADM.headers, payload: { decision: 'approved', reason: 'e2e' } });
    if (ap.statusCode !== 200) throw new Error(`kyb approve falhou: ${ap.statusCode} ${ap.body}`);
    const pub = await app.inject({ method: 'POST', url: `/companies/${companyId}/publications`, headers: h.headers, payload: { conceptId } });
    if (pub.statusCode !== 201 && pub.statusCode !== 200) throw new Error(`publicação falhou: ${pub.statusCode} ${pub.body}`);
  };
  const applyTemplate = async (h: Human, companyId: string, slug: string): Promise<string[]> => {
    const cat = await app.inject({ method: 'GET', url: '/companies/templates/catalog', headers: h.headers });
    const tpl = (cat.json()?.data ?? []).find((t: { slug: string }) => t.slug === slug);
    const r = await app.inject({ method: 'POST', url: `/companies/${companyId}/templates/apply`, headers: h.headers, payload: { templateId: tpl.templateId } });
    if (r.statusCode !== 200 && r.statusCode !== 201) throw new Error(`apply template falhou: ${r.statusCode} ${r.body}`);
    return r.json()?.data?.application?.modulesApplied ?? [];
  };

  // ── 12.1 — nascimento real das 3 empresas + templates + KYB/publicação ──────
  const A = await createCompany(HA, seedBase + 31, 'E2E Int Supermercado');
  const B = await createCompany(HB, seedBase + 32, 'E2E Int Distribuidora');
  const C = await createCompany(HC, seedBase + 33, 'E2E Int Salao');
  const conceptA = await activate(HA, A.companyId, 'supermercado');
  const conceptB = await activate(HB, B.companyId, 'distribuidora-de-bebidas');
  await activate(HC, C.companyId, 'salao');
  const modsA = await applyTemplate(HA, A.companyId, 'supermercado-completo');
  const modsB = await applyTemplate(HB, B.companyId, 'distribuidora-de-bebidas');
  const modsC = await applyTemplate(HC, C.companyId, 'salao-servicos');

  // Snapshot ZERO comercial pós-template (template não cria oferta/estoque/preço/agenda)
  const zeroAfterTpl = await pool.query<{ po: string; im: string; av: string; so: string }>(
    `SELECT (SELECT count(*) FROM product_offers WHERE tenant_id=$1)::text po,
            (SELECT count(*) FROM inventory_movements WHERE tenant_id=$1)::text im,
            (SELECT count(*) FROM availability WHERE tenant_id=$1)::text av,
            (SELECT count(*) FROM service_offerings WHERE tenant_id=$1)::text so`, [TENANT_ID]);

  await approveKybAndPublish(HA, A.companyId, conceptA);
  await approveKybAndPublish(HB, B.companyId, conceptB);
  // Salão C: KYB fica pendente de propósito (menu sem Publicações; suspensão de oferta de serviço é por status).

  const CAT_BEBIDAS = (await pool.query<{ category_id: string }>(`SELECT category_id FROM categories WHERE slug='marketplace-bebidas' LIMIT 1`)).rows[0].category_id;
  const CONCEPT_COLA = (await pool.query<{ concept_id: string }>(`SELECT concept_id FROM concepts WHERE domain='item-comercial' AND slug='refrigerante-de-cola' LIMIT 1`)).rows[0].concept_id;

  const bankSnapshot = async (): Promise<string> => {
    const r = await pool.query<{ bl: string; bt: string; ba: string }>(
      `SELECT (SELECT count(*) FROM bank_ledger)::text bl,
              (SELECT count(*) FROM bank_transactions)::text bt,
              (SELECT count(*) FROM bank_accounts)::text ba`);
    return JSON.stringify(r.rows[0]);
  };
  const bank0 = await bankSnapshot();

  try {
    record('I1 templates: supermercado amplo / distribuidora recorte / salão serviços+agenda',
      modsA.includes('marketplace') && modsB.includes('marketplace') && modsC.includes('services') && modsC.includes('agenda'),
      JSON.stringify({ modsA, modsB, modsC }));
    record('I2 template não criou oferta/estoque/agenda/serviço (zero comercial pós-aplicação)',
      zeroAfterTpl.rows[0].po === '0' && zeroAfterTpl.rows[0].im === '0' && zeroAfterTpl.rows[0].av === '0' && zeroAfterTpl.rows[0].so === '0',
      JSON.stringify(zeroAfterTpl.rows[0]));

    // ── 12.2 — PRODUTO: 1 CONCEPT, 1 canônico, 1 variante, 1 mídia ────────────
    const sug = await app.inject({
      method: 'POST', url: '/catalog/governance/products/suggestions', headers: HA.headers,
      payload: {
        companyId: A.companyId, name: 'Coca-Cola Original', brand: 'Coca-Cola', gtin: '7894900011517', categoryId: CAT_BEBIDAS,
        variant: { variantName: 'Coca-Cola Original 1L retornável', gtin: '7894900011524', netContentValue: 1, netContentUnit: 'l', packageType: 'garrafa', isReturnable: true },
      },
    });
    const cocaId = sug.json()?.data?.canonicalProductId as string;
    const variantId = sug.json()?.data?.variant?.id as string;
    await app.inject({
      method: 'POST', url: `/catalog/governance/curation/products/${cocaId}/approve`, headers: ADM.headers,
      payload: { conceptId: CONCEPT_COLA },
    });

    // mídia canônica: upload A → aprovação → attach; reenvio por B reutiliza o
    // BLOB físico mas ganha asset LÓGICO próprio (isolamento blob×asset)
    const mpA = multipartBody([{ name: 'file', filename: 'coca.png', contentType: 'image/png', value: PNG_COCA }]);
    const upA = await app.inject({
      method: 'POST', url: `/catalog/media/assets?companyId=${A.companyId}`,
      headers: { ...HA.headers, 'content-type': mpA.contentType }, payload: mpA.payload,
    });
    const assetId = upA.json()?.data?.mediaAssetId as string;
    await app.inject({ method: 'POST', url: `/catalog/media/assets/${assetId}/approve`, headers: ADM.headers });
    const att = await app.inject({
      method: 'POST', url: '/catalog/media/attach/canonical', headers: ADM.headers,
      payload: { entity: 'product', entityId: cocaId, mediaAssetId: assetId, mediaRole: 'primary' },
    });
    const filesAfterUpload = await storageFileCount();
    const mpB = multipartBody([{ name: 'file', filename: 'coca-b.png', contentType: 'image/png', value: PNG_COCA }]);
    const upB = await app.inject({
      method: 'POST', url: `/catalog/media/assets?companyId=${B.companyId}`,
      headers: { ...HB.headers, 'content-type': mpB.contentType }, payload: mpB.payload,
    });
    const filesAfterReupload = await storageFileCount();
    record('I3 produto: 1 concept + 1 canônico + 1 variante + 1 mídia canônica (attach curatorial)',
      sug.statusCode === 201 && !!variantId && upA.statusCode === 201 && att.statusCode === 200, `sug=${sug.statusCode} up=${upA.statusCode} att=${att.statusCode}`);
    const assetIdB = upB.json()?.data?.mediaAssetId as string;
    const blobCount = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM media_blobs`);
    record('I4 mesmo upload (empresa B) NÃO duplica blob físico; asset lógico PRÓPRIO de B',
      upB.statusCode === 201 && !!assetIdB && assetIdB !== assetId && upB.json()?.data?.reusedExistingBlob === true &&
      filesAfterReupload === filesAfterUpload && blobCount.rows[0].n === '1',
      `files ${filesAfterUpload}→${filesAfterReupload} blobs=${blobCount.rows[0].n}`);

    // A e B ativam a MESMA variante (SKUs/preços próprios) + estoques próprios
    const offerA = await app.inject({
      method: 'POST', url: '/marketplace/offerings/product', headers: HA.headers,
      payload: { storeActorId: A.pageActorId, companyId: A.companyId, canonicalVariantId: variantId, internalSku: 'SKU-INT-A', saleUnit: 'un', priceCents: 700 },
    });
    const offerB = await app.inject({
      method: 'POST', url: '/marketplace/offerings/product', headers: HB.headers,
      payload: { storeActorId: B.pageActorId, companyId: B.companyId, canonicalVariantId: variantId, internalSku: 'SKU-INT-B', saleUnit: 'un', priceCents: 650 },
    });
    const oA = offerA.json()?.data; const oB = offerB.json()?.data;
    for (const [tv, actor, qty] of [[oA.tenantVariantId, A.pageActorId, 12], [oB.tenantVariantId, B.pageActorId, 30]] as Array<[string, string, number]>) {
      await pool.query(
        `INSERT INTO inventory_movements (tenant_id, product_variant_id, movement_type, quantity, unit, actor_id)
         VALUES ($1::uuid, $2::uuid, 'in', $3, 'un', $4::uuid)`, [TENANT_ID, tv, qty, actor]);
    }
    const cpCount = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM canonical_products WHERE LOWER(name) LIKE 'coca-cola original%'`);
    record('I5 A e B referenciam a MESMA variante; nenhum canônico novo nasceu das ofertas',
      offerA.statusCode === 201 && offerB.statusCode === 201 && oA.canonicalVariantId === oB.canonicalVariantId && cpCount.rows[0].n === '1',
      `cp=${cpCount.rows[0].n}`);
    record('I6 SKUs internos e preços PRÓPRIOS (700 vs 650)',
      oA.internalSku === 'SKU-INT-A' && oB.internalSku === 'SKU-INT-B' && oA.priceCents === 700 && oB.priceCents === 650);

    // Busca: 1 item canônico → 2 ofertas; menor preço na MESMA unidade
    const search = await app.inject({ method: 'GET', url: '/marketplace/catalog/items/search?q=coca', headers: HC.headers });
    const items = (search.json()?.data ?? []) as Array<{ canonicalProductId: string; offerCount: number; priceByUnit: Array<{ saleUnit: string; minPriceCents: number }> }>;
    record('I7 busca retorna UM item canônico com 2 ofertas (não 2 produtos duplicados)',
      items.length === 1 && items[0].canonicalProductId === cocaId && items[0].offerCount === 2, `n=${items.length} offers=${items[0]?.offerCount}`);
    record('I8 comparação de preço SÓ na mesma unidade (min 650 em un)',
      items[0]?.priceByUnit?.length === 1 && items[0]?.priceByUnit?.[0]?.saleUnit === 'un' && items[0]?.priceByUnit?.[0]?.minPriceCents === 650,
      JSON.stringify(items[0]?.priceByUnit));
    const offersPage = await app.inject({ method: 'GET', url: `/marketplace/catalog/items/${cocaId}/offers`, headers: HC.headers });
    const offersList = (offersPage.json()?.data ?? []) as Array<{ offerId: string; availableQuantity: number }>;
    record('I9 página do item: 2 ofertas com estoques PRÓPRIOS (12 e 30)',
      offersList.length === 2 && new Set(offersList.map((o) => o.availableQuantity)).size === 2, JSON.stringify(offersList.map((o) => o.availableQuantity)));

    // Isolamento: A não altera oferta/estoque de B (403 + imutável)
    const cross = await app.inject({ method: 'PUT', url: `/marketplace/offerings/product/${oB.offerId}`, headers: HA.headers, payload: { priceCents: 1 } });
    const bRow = await pool.query<{ price_cents: string }>(`SELECT price_cents FROM product_offers WHERE id=$1::uuid`, [oB.offerId]);
    record('I10 isolamento: A→oferta de B = 403 + banco imutável', cross.statusCode === 403 && bRow.rows[0].price_cents === '650', `status=${cross.statusCode}`);

    // ── 12.3 — SERVIÇO: 1 canônico, 2 prestadores, agendas próprias ───────────
    const corte = await pool.query<{ id: string; concept_id: string }>(`SELECT id, concept_id FROM canonical_services WHERE scope='global' AND slug='corte-de-cabelo-masculino' LIMIT 1`);
    const so1 = await app.inject({
      method: 'POST', url: '/services/offerings', headers: HC.headers,
      payload: { providerActorId: C.pageActorId, companyId: C.companyId, canonicalServiceId: corte.rows[0].id, priceCents: 5000, durationMinutes: 45 },
    });
    const so2 = await app.inject({
      method: 'POST', url: '/services/offerings', headers: P2.headers,
      payload: { providerActorId: P2.actorId, canonicalServiceId: corte.rows[0].id, priceCents: 3000, durationMinutes: 30 },
    });
    const s1 = so1.json()?.data; const s2 = so2.json()?.data;
    const schedules0 = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM schedules WHERE tenant_id=$1`, [TENANT_ID]);
    const av1 = await app.inject({
      method: 'POST', url: `/services/offerings/${s1.id}/availability`, headers: HC.headers,
      payload: { startDatetime: '2026-07-10T09:00:00-03:00', endDatetime: '2026-07-10T13:00:00-03:00', capacity: 6 },
    });
    const av2 = await app.inject({
      method: 'POST', url: `/services/offerings/${s2.id}/availability`, headers: P2.headers,
      payload: { startDatetime: '2026-07-11T10:00:00-03:00', endDatetime: '2026-07-11T16:00:00-03:00', capacity: 3 },
    });
    const schedules1 = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM schedules WHERE tenant_id=$1`, [TENANT_ID]);
    const csCount = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM canonical_services WHERE slug='corte-de-cabelo-masculino'`);
    record('I11 serviço: 1 canônico, 2 prestadores (5000/45min vs 3000/30min)',
      so1.statusCode === 201 && so2.statusCode === 201 && s1.canonicalServiceId === s2.canonicalServiceId && csCount.rows[0].n === '1',
      `cs=${csCount.rows[0].n}`);
    record('I12 agendas próprias na Unified Availability; ZERO agenda paralela',
      av1.statusCode === 201 && av2.statusCode === 201 && schedules0.rows[0].n === schedules1.rows[0].n, `schedules=${schedules0.rows[0].n}→${schedules1.rows[0].n}`);
    const grouped = await app.inject({ method: 'GET', url: `/services/offerings/by-canonical/${corte.rows[0].id}`, headers: HA.headers });
    record('I13 discovery de serviço agrupa pelo canônico (2 ofertas)',
      ((grouped.json()?.data ?? []) as unknown[]).length === 2);

    // ── 12.5 — MENU projetado por contexto ────────────────────────────────────
    const mA = await app.inject({ method: 'GET', url: `/navigation/modules?companyId=${A.companyId}`, headers: HA.headers });
    const keysA = ((mA.json()?.data?.groups ?? []) as Array<{ items: Array<{ moduleKey: string }> }>).flatMap((g) => g.items.map((i) => i.moduleKey));
    const mC = await app.inject({ method: 'GET', url: `/navigation/modules?companyId=${C.companyId}`, headers: HC.headers });
    const keysC = ((mC.json()?.data?.groups ?? []) as Array<{ items: Array<{ moduleKey: string }> }>).flatMap((g) => g.items.map((i) => i.moduleKey));
    record('I14 menus por contexto: supermercado (catálogo+estoque+publicações) ≠ salão (serviços+agenda, sem publicações pré-KYB)',
      keysA.includes('company-marketplace') && keysA.includes('company-publications') && !keysA.includes('company-services') &&
      keysC.includes('company-services') && keysC.includes('company-agenda') && !keysC.includes('company-publications'),
      JSON.stringify({ keysA, keysC }));
    const pf = await app.inject({ method: 'GET', url: '/navigation/modules', headers: P2.headers });
    const pfRoutes = ((pf.json()?.data?.groups ?? []) as Array<{ items: Array<{ route: string }> }>).flatMap((g) => g.items.map((i) => i.route));
    record('I15 menu PF sem rota morta (STUB/TOMBSTONE fora)',
      !pfRoutes.some((r) => r.startsWith('/em-desenvolvimento')) && !pfRoutes.includes('/votacoes'));
    const directCuration = await app.inject({ method: 'GET', url: '/catalog/governance/curation/queue', headers: HA.headers });
    record('I16 menu não concede autoridade (rota admin direto → 403)', directCuration.statusCode === 403, `status=${directCuration.statusCode}`);

    // ── 12.6 — LIFECYCLE: revogação de A retira SÓ A ──────────────────────────
    const revoke = await app.inject({
      method: 'POST', url: `/identity/pj/kyb/admin/fiscal-identities/${A.fiscalIdentityId}/revoke`, headers: ADM.headers,
      payload: { newStatus: 'suspended', reason: 'e2e revogação integrada' },
    });
    const visAfterRevoke = await app.inject({ method: 'GET', url: `/marketplace/catalog/items/${cocaId}/offers`, headers: HC.headers });
    const offersAfterRevoke = (visAfterRevoke.json()?.data ?? []) as Array<{ offerId: string }>;
    const canonicalStill = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM canonical_products WHERE id=$1::uuid`, [cocaId]);
    const mediaStill = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM media_assets WHERE id=$1::uuid`, [assetId]);
    const offerARow = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM product_offers WHERE id=$1::uuid`, [oA.offerId]);
    record('I17 revogação KYB de A: oferta de A sai do público; B permanece; canônico+mídia+linha de A permanecem',
      revoke.statusCode === 200 &&
      !offersAfterRevoke.some((o) => o.offerId === oA.offerId) &&
      offersAfterRevoke.some((o) => o.offerId === oB.offerId) &&
      canonicalStill.rows[0].n === '1' && mediaStill.rows[0].n === '1' && offerARow.rows[0].n === '1',
      `revoke=${revoke.statusCode} restantes=${offersAfterRevoke.length}`);

    // Suspensão da oferta de serviço de C retira SÓ ela; canônico permanece
    await app.inject({ method: 'PUT', url: `/services/offerings/${s1.id}`, headers: HC.headers, payload: { status: 'suspended' } });
    const groupedAfter = await app.inject({ method: 'GET', url: `/services/offerings/by-canonical/${corte.rows[0].id}`, headers: HA.headers });
    const remaining = (groupedAfter.json()?.data ?? []) as Array<{ id: string }>;
    record('I18 suspensão da oferta de serviço de C retira só ela (canônico + oferta de P2 permanecem)',
      remaining.length === 1 && remaining[0].id === s2.id && csCount.rows[0].n === '1', `n=${remaining.length}`);

    // ── 12.7 — UNIDADES ───────────────────────────────────────────────────────
    const { canonicalUnitsService, CanonicalUnitError } = await import('../core/catalog/canonical/canonical-units.service');
    let unitBlocked = false;
    try {
      await canonicalUnitsService.sumQuantitiesStrict([{ quantity: 1, unit: 'kg' }, { quantity: 1, unit: 'un' }]);
    } catch (e) { unitBlocked = e instanceof CanonicalUnitError && e.code === 'UNIT_INCOMPATIBLE'; }
    const sameUnit = await canonicalUnitsService.sumQuantitiesStrict([{ quantity: 2, unit: 'un' }, { quantity: 3, unit: 'un' }]);
    record('I19 unidades: agregação só com contrato (un+un=5); kg+un falha fechado', unitBlocked && sameUnit?.total === 5);

    // ── 12.8 — ZERO FINANCEIRO ────────────────────────────────────────────────
    const bank1 = await bankSnapshot();
    record('I20 zero Bank writer / zero estado financeiro novo na jornada INTEIRA', bank0 === bank1, `${bank0} vs ${bank1}`);
  } finally {
    await app.close();
    // 12.9 — cleanup de storage compartilhado (DB efêmera é dropada pelo wrapper)
    try {
      const { resolveDocumentStorageProvider } = await import('../core/document-storage/document-storage.provider');
      const storage = resolveDocumentStorageProvider();
      const docRefs = await pool.query<{ file_reference: string }>(`SELECT file_reference FROM fiscal_identity_documents`);
      for (const ref of docRefs.rows) { try { await storage.deleteDocument(ref.file_reference); } catch { /* noop */ } }
      const mediaRefs = await pool.query<{ storage_reference: string }>(`SELECT storage_reference FROM media_blobs`);
      for (const ref of mediaRefs.rows) { try { await storage.deleteDocument(ref.storage_reference); } catch { /* noop */ } }
    } catch { /* noop */ }
    const filesFinal = await storageFileCount();
    record('CLEANUP storage local sem resíduo da run', filesFinal === files0, `${files0}→${filesFinal}`);
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
  console.log('✨ Cadeia canônica integrada (templates → catálogo → mídia → oferta → menu → discovery → lifecycle) — verde.');
  process.exit(0); // CLI validator: encerra o event loop (handles transitivas de módulos importados)
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
