/**
 * E2E CP5 F-CANONICAL-CATALOG-BUSINESS-TEMPLATES-AND-OFFERING-CLOSURE — menu de
 * módulos PROJETADO do registry + busca/discovery agrupada por identidade
 * canônica (DECISION-0117 F), HTTP real.
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-module-menu-discovery-ephemeral.ps1.
 *
 * Prova (GO §11.6):
 *   - menu PF projetado do registry (STUB/TOMBSTONE NUNCA aparecem como operacionais);
 *   - menu de empresa por contexto: supermercado (marketplace+inventory) ≠ salão
 *     (services+agenda); módulo sem template/capability NÃO aparece;
 *   - publicações só com KYB aprovado; sem vínculo ativo → 403;
 *   - MENU NÃO CONCEDE AUTORIDADE: rota chamada direto sem autoridade → 403/gate
 *     (mesmo quando o item nem aparece no menu);
 *   - busca pública agrupa: 1 item canônico → N ofertas (sem duplicar o produto);
 *   - serviço agrupado pelo canônico (N prestadores);
 *   - zero Bank writer.
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
const PDF = Buffer.from('%PDF-1.4\n%e2e menu discovery\n%%EOF\n');

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

async function main(): Promise<void> {
  await assertEphemeralDb();
  await bootstrapSocialPorts();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Module Menu Discovery Test', slug: `module-menu-${Date.now()}` });
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
    const ac = JSON.stringify({ actorId, intent: 'menu_e2e', source: 'e2e', scope: `tenant:${TENANT_ID}` });
    return { globalId, userId, actorId, headers: { authorization: `Bearer ${token}`, 'x-action-context': ac } };
  };

  const F1 = await mkHuman('E2E Menu Founder Super');
  const F2 = await mkHuman('E2E Menu Founder Distrib');
  const FB = await mkHuman('E2E Menu Founder Salao');
  const OUT = await mkHuman('E2E Menu Outsider');
  const ADM = await mkHuman('E2E Menu Curator', 'admin');

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
    return { companyId, pageActorId: pa.rows[0].id };
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
    await app.inject({ method: 'PATCH', url: `/identity/pj/kyb/admin/requests/${kybRequestId}/review`, headers: ADM.headers, payload: { decision: 'approved', reason: 'e2e' } });
    await app.inject({ method: 'POST', url: `/companies/${companyId}/publications`, headers: h.headers, payload: { conceptId } });
  };
  const applyTemplate = async (h: Human, companyId: string, slug: string): Promise<void> => {
    const cat = await app.inject({ method: 'GET', url: '/companies/templates/catalog', headers: h.headers });
    const tpl = (cat.json()?.data ?? []).find((t: { slug: string }) => t.slug === slug);
    const r = await app.inject({ method: 'POST', url: `/companies/${companyId}/templates/apply`, headers: h.headers, payload: { templateId: tpl.templateId } });
    if (r.statusCode !== 200 && r.statusCode !== 201) throw new Error(`apply template falhou: ${r.statusCode} ${r.body}`);
  };

  const A = await createCompany(F1, seedBase + 21, 'E2E Menu Supermercado');
  const B = await createCompany(F2, seedBase + 22, 'E2E Menu Distribuidora');
  const S = await createCompany(FB, seedBase + 23, 'E2E Menu Salao');
  const conceptA = await activate(F1, A.companyId, 'supermercado');
  const conceptB = await activate(F2, B.companyId, 'distribuidora-de-bebidas');
  await activate(FB, S.companyId, 'salao');
  await approveKybAndPublish(F1, A.companyId, conceptA);
  await approveKybAndPublish(F2, B.companyId, conceptB);
  // Salão fica SEM KYB de propósito (menu sem 'Publicações' + backend revalida).
  await applyTemplate(F1, A.companyId, 'supermercado-completo');
  await applyTemplate(F2, B.companyId, 'distribuidora-de-bebidas');
  await applyTemplate(FB, S.companyId, 'salao-servicos');

  const bank0 = await pool.query<{ n: string }>(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`);

  try {
    // N1 — menu PF projetado do registry; STUB/TOMBSTONE fora
    const pf = await app.inject({ method: 'GET', url: '/navigation/modules', headers: F1.headers });
    const pfGroups = (pf.json()?.data?.groups ?? []) as Array<{ title: string; items: Array<{ route: string; moduleKey: string }> }>;
    const allRoutes = pfGroups.flatMap((g) => g.items.map((i) => i.route));
    record('N1a menu PF projetado (marketplace e services operacionais)',
      pf.statusCode === 200 && allRoutes.includes('/marketplace') && allRoutes.includes('/services'), `n=${allRoutes.length}`);
    record('N1b rota morta NÃO aparece (STUB /em-desenvolvimento e TOMBSTONE /votacoes fora)',
      !allRoutes.some((r) => r.startsWith('/em-desenvolvimento')) && !allRoutes.includes('/votacoes'), JSON.stringify(allRoutes));

    // N2 — contexto empresa exige vínculo ativo
    const noLink = await app.inject({ method: 'GET', url: `/navigation/modules?companyId=${A.companyId}`, headers: OUT.headers });
    record('N2 menu de empresa sem vínculo → 403', noLink.statusCode === 403, `status=${noLink.statusCode}`);

    // N3 — menu do SUPERMERCADO: marketplace+inventory+publicações; SEM services/agenda
    const mA = await app.inject({ method: 'GET', url: `/navigation/modules?companyId=${A.companyId}`, headers: F1.headers });
    const keysA = ((mA.json()?.data?.groups ?? []) as Array<{ items: Array<{ moduleKey: string }> }>).flatMap((g) => g.items.map((i) => i.moduleKey));
    record('N3 menu supermercado = catálogo+estoque+publicações (sem serviços/agenda)',
      keysA.includes('company-marketplace') && keysA.includes('company-inventory') && keysA.includes('company-publications') &&
      !keysA.includes('company-services') && !keysA.includes('company-agenda'), JSON.stringify(keysA));

    // N4 — menu da DISTRIBUIDORA: também marketplace+inventory (recorte é de catálogo, não de menu)
    const mB = await app.inject({ method: 'GET', url: `/navigation/modules?companyId=${B.companyId}`, headers: F2.headers });
    const keysB = ((mB.json()?.data?.groups ?? []) as Array<{ items: Array<{ moduleKey: string }> }>).flatMap((g) => g.items.map((i) => i.moduleKey));
    record('N4 menu distribuidora = catálogo+estoque (módulos do template)',
      keysB.includes('company-marketplace') && keysB.includes('company-inventory') && !keysB.includes('company-services'), JSON.stringify(keysB));

    // N5 — menu do SALÃO: services+agenda; SEM marketplace/inventory; SEM publicações (sem KYB)
    const mS = await app.inject({ method: 'GET', url: `/navigation/modules?companyId=${S.companyId}`, headers: FB.headers });
    const keysS = ((mS.json()?.data?.groups ?? []) as Array<{ items: Array<{ moduleKey: string }> }>).flatMap((g) => g.items.map((i) => i.moduleKey));
    record('N5 menu salão = serviços+agenda; sem marketplace; sem publicações (KYB pendente)',
      keysS.includes('company-services') && keysS.includes('company-agenda') &&
      !keysS.includes('company-marketplace') && !keysS.includes('company-publications'), JSON.stringify(keysS));

    // N6 — MENU NÃO CONCEDE AUTORIDADE: backend revalida mesmo com item visível/invisível
    const directPub = await app.inject({
      method: 'POST', url: `/companies/${S.companyId}/publications`, headers: FB.headers,
      payload: { conceptId: conceptA },
    });
    record('N6a item fora do menu E rota chamada direto → gate do backend bloqueia (KYB/concept)',
      directPub.statusCode >= 400 && directPub.statusCode < 500, `status=${directPub.statusCode}`);
    const directCuration = await app.inject({ method: 'GET', url: '/catalog/governance/curation/queue', headers: F1.headers });
    record('N6b rota admin direto sem papel → 403 (menu nunca autoriza)', directCuration.statusCode === 403, `status=${directCuration.statusCode}`);

    // N7 — BUSCA agrupada por identidade: 1 item canônico → 2 ofertas (A e B)
    const CAT_BEBIDAS = (await pool.query<{ category_id: string }>(`SELECT category_id FROM categories WHERE slug='marketplace-bebidas' LIMIT 1`)).rows[0].category_id;
    const CONCEPT_COLA = (await pool.query<{ concept_id: string }>(`SELECT concept_id FROM concepts WHERE domain='item-comercial' AND slug='refrigerante-de-cola' LIMIT 1`)).rows[0].concept_id;
    const sug = await app.inject({
      method: 'POST', url: '/catalog/governance/products/suggestions', headers: F1.headers,
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
    const offerA = await app.inject({
      method: 'POST', url: '/marketplace/offerings/product', headers: F1.headers,
      payload: { storeActorId: A.pageActorId, companyId: A.companyId, canonicalVariantId: variantId, internalSku: 'SKU-MENU-A', saleUnit: 'un', priceCents: 700 },
    });
    const offerB = await app.inject({
      method: 'POST', url: '/marketplace/offerings/product', headers: F2.headers,
      payload: { storeActorId: B.pageActorId, companyId: B.companyId, canonicalVariantId: variantId, internalSku: 'SKU-MENU-B', saleUnit: 'un', priceCents: 650 },
    });
    for (const [tv, actor] of [
      [offerA.json()?.data?.tenantVariantId, A.pageActorId],
      [offerB.json()?.data?.tenantVariantId, B.pageActorId],
    ] as Array<[string, string]>) {
      await pool.query(
        `INSERT INTO inventory_movements (tenant_id, product_variant_id, movement_type, quantity, unit, actor_id)
         VALUES ($1::uuid, $2::uuid, 'IN', 8, 'un', $3::uuid)`,
        [TENANT_ID, tv, actor]
      );
    }
    const search = await app.inject({ method: 'GET', url: '/marketplace/catalog/items/search?q=coca', headers: F1.headers });
    const items = (search.json()?.data ?? []) as Array<{ canonicalProductId: string; offerCount: number; priceByUnit: Array<{ saleUnit: string; minPriceCents: number; offerCount: number }> }>;
    record('N7a busca retorna 1 item canônico (não N duplicatas por empresa)',
      search.statusCode === 200 && items.length === 1 && items[0].canonicalProductId === cocaId, `n=${items.length}`);
    record('N7b item agrega 2 ofertas com menor preço POR unidade (650 em un)',
      items[0]?.offerCount === 2 && items[0]?.priceByUnit?.[0]?.saleUnit === 'un' && items[0]?.priceByUnit?.[0]?.minPriceCents === 650,
      JSON.stringify(items[0]?.priceByUnit));
    const offersPage = await app.inject({ method: 'GET', url: `/marketplace/catalog/items/${cocaId}/offers`, headers: OUT.headers });
    const offersList = (offersPage.json()?.data ?? []) as Array<{ merchantActorId: string; priceCents: number }>;
    record('N7c página do item lista as 2 ofertas empresariais (merchants distintos)',
      offersList.length === 2 && new Set(offersList.map((o) => o.merchantActorId)).size === 2, `n=${offersList.length}`);

    // N8 — serviço agrupado pelo canônico (2 prestadores)
    const corte = await pool.query<{ id: string }>(`SELECT id FROM canonical_services WHERE scope='global' AND slug='corte-de-cabelo-masculino' LIMIT 1`);
    await app.inject({
      method: 'POST', url: '/services/offerings', headers: FB.headers,
      payload: { providerActorId: S.pageActorId, companyId: S.companyId, canonicalServiceId: corte.rows[0].id, priceCents: 5000, durationMinutes: 45 },
    });
    await app.inject({
      method: 'POST', url: '/services/offerings', headers: OUT.headers,
      payload: { providerActorId: OUT.actorId, canonicalServiceId: corte.rows[0].id, priceCents: 3000, durationMinutes: 30 },
    });
    const grouped = await app.inject({ method: 'GET', url: `/services/offerings/by-canonical/${corte.rows[0].id}`, headers: F1.headers });
    const offerings = (grouped.json()?.data ?? []) as Array<{ providerActorId: string }>;
    record('N8 serviço agrupado: 1 canônico → 2 prestadores/ofertas',
      grouped.statusCode === 200 && offerings.length === 2 && new Set(offerings.map((o) => o.providerActorId)).size === 2, `n=${offerings.length}`);

    // N9 — zero Bank writer
    const bank1 = await pool.query<{ n: string }>(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`);
    record('N9 zero Bank writer', bank0.rows[0].n === bank1.rows[0].n, `${bank0.rows[0].n} vs ${bank1.rows[0].n}`);
  } finally {
    await app.close();
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
  console.log('✨ Menu projetado do registry + discovery canônica agrupada — verde.');
  process.exit(0); // CLI validator: encerra o event loop (handles transitivas de módulos importados)
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
