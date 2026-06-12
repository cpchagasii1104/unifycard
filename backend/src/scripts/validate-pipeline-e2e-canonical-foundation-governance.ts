/**
 * E2E CP1 F-CANONICAL-CATALOG-BUSINESS-TEMPLATES-AND-OFFERING-CLOSURE — fundação canônica
 * e governança (DECISION-0117 A/B/D/G/H), HTTP real via app.inject.
 *
 * 🔒 DB EFÊMERA (catálogo de teste NUNCA polui o seed do dev). Guard duro:
 *    current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-canonical-foundation-ephemeral.ps1.
 *
 * Prova (GO §7.8):
 *   - mesmo GTIN não duplica; mesmo fingerprint não duplica; marca com grafia
 *     normalizada (Nestlé/NESTLE) não duplica;
 *   - retornável ≠ descartável; 1L ≠ 2L (eixos no fingerprint da variante);
 *   - empresa NÃO cria canônico global READY (sugestão = scoped + unresolved +
 *     fila pendente); curadoria humana (admin) aprova/promove; não-admin → 403;
 *   - produto LOCAL fica scoped (dedup local; sem GTIN);
 *   - serviço canônico compartilhado não duplica por empresa; writer de services
 *     EXIGE canonical_service_id ativo (pending → bloqueado);
 *   - merge preserva referências (redirect duplicate_of, append-only, idempotente);
 *   - unidades incompatíveis falham fechado (kg+un, l+garrafa, unidade desconhecida);
 *   - zero Bank writer; zero actor cure (usuário sem actor → 403 sem efeito).
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
  if (!/canonical|catalog|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
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
  const catalogGovernanceRoutes = (await import('../core/catalog/catalog-governance.routes')).default;
  await app.register(catalogGovernanceRoutes, { prefix: '/catalog/governance' });
  const servicesModule = (await import('../modules/services/services.module')).default;
  await app.register(servicesModule, { prefix: '/services' });
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
  await tenantService.createTenant({ id: TENANT_ID, name: 'Canonical Foundation Test', slug: `canonical-foundation-${Date.now()}` });
  await rbacService.seedDefaultRBAC(TENANT_ID);

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const actorRepo = socialPortsRegistry.getActorRepository();

  let cpfSeq = Date.now() % 100000000;
  const mkHuman = async (name: string, role?: 'admin', withActor = true): Promise<Human> => {
    const globalId = randomUUID();
    const userId = randomUUID();
    const cpf = String(cpfSeq++).padStart(11, '0').slice(-11);
    await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,$3,'{}'::jsonb)`, [globalId, cpf, name]);
    await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [globalId, cpf]);
    await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`, [userId, TENANT_ID, globalId, `${userId}@e2e.local`]);
    const actorId = withActor ? (await actorRepo.findOrCreateUserActor(TENANT_ID, userId)).actor_id : userId;
    if (role === 'admin') await rbacService.assignRoleByName(TENANT_ID, userId, 'admin');
    const token = jwt.sign(
      { sub: userId, userId, tenantId: TENANT_ID, email: `${userId}@e2e.local`, tokenVersion: 0, globalUserId: globalId, type: 'access' },
      JWT_SECRET as string,
      { expiresIn: '15m' }
    );
    const ac = JSON.stringify({ actorId, intent: 'canonical_e2e', source: 'e2e', scope: `tenant:${TENANT_ID}` });
    return { globalId, userId, actorId, headers: { authorization: `Bearer ${token}`, 'x-action-context': ac } };
  };

  const F1 = await mkHuman('E2E Canon Founder A');
  const F2 = await mkHuman('E2E Canon Founder B');
  const CUR = await mkHuman('E2E Canon Curator', 'admin');
  const P2 = await mkHuman('E2E Canon Provider Two');
  const NA = await mkHuman('E2E Canon NoActor', undefined, false);

  const app = await buildApp();

  const createCompany = async (h: Human, seed: number, name: string): Promise<string> => {
    const r = await app.inject({
      method: 'POST', url: '/companies', headers: h.headers,
      payload: { cnpj: makeValidCnpj(seed), companyName: name, role: 'owner', fetchFromRevenue: false },
    });
    if (r.statusCode !== 201) throw new Error(`createCompany falhou: ${r.statusCode} ${r.body}`);
    return r.json().company.companyId as string;
  };

  const cnpjSeedBase = Date.now() % 90000000;
  const companyA = await createCompany(F1, cnpjSeedBase + 1, 'E2E Canon Supermercado');
  const companyB = await createCompany(F2, cnpjSeedBase + 2, 'E2E Canon Distribuidora');

  const catRow = await pool.query<{ category_id: string }>(
    `SELECT category_id FROM categories WHERE slug = 'marketplace-bebidas' LIMIT 1`
  );
  const CAT_BEBIDAS = catRow.rows[0]?.category_id;
  if (!CAT_BEBIDAS) throw new Error('categoria marketplace-bebidas ausente na DB efêmera');
  const svcCatRow = await pool.query<{ category_id: string }>(
    `SELECT category_id FROM categories WHERE slug = 'servicos-cabeleireiro' LIMIT 1`
  );
  const CAT_CABELEIREIRO = svcCatRow.rows[0]?.category_id;
  if (!CAT_CABELEIREIRO) throw new Error('categoria servicos-cabeleireiro ausente na DB efêmera');
  const conceptCola = await pool.query<{ concept_id: string }>(
    `SELECT concept_id FROM concepts WHERE domain='item-comercial' AND slug='refrigerante-de-cola' LIMIT 1`
  );
  const CONCEPT_COLA = conceptCola.rows[0]?.concept_id;
  if (!CONCEPT_COLA) throw new Error('concept refrigerante-de-cola ausente (seed da migration 20260611150000)');
  const conceptBeleza = await pool.query<{ concept_id: string }>(
    `SELECT concept_id FROM concepts WHERE domain='servicos' AND slug='servicos-pessoais-beleza' LIMIT 1`
  );
  const CONCEPT_BELEZA = conceptBeleza.rows[0]?.concept_id;
  if (!CONCEPT_BELEZA) throw new Error('concept servicos-pessoais-beleza ausente');

  const econSnapshot = async (): Promise<string> => {
    const r = await pool.query<{ bl: string; bt: string; im: string; ib: string }>(
      `SELECT (SELECT count(*) FROM bank_ledger)::text bl,
              (SELECT count(*) FROM bank_transactions)::text bt,
              (SELECT count(*) FROM inventory_movements)::text im,
              (SELECT count(*) FROM inventory_balances)::text ib`
    );
    return JSON.stringify(r.rows[0]);
  };
  const actorCount = async (): Promise<number> => {
    const r = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM actors WHERE tenant_id = $1`, [TENANT_ID]);
    return parseInt(r.rows[0].n, 10);
  };

  const econBefore = await econSnapshot();
  const GTIN_COCA = '7894900011517';

  try {
    // ── T1: sugestão INDUSTRIAL nasce scoped + unresolved + fila (NUNCA global READY) ──
    const t1 = await app.inject({
      method: 'POST', url: '/catalog/governance/products/suggestions', headers: F1.headers,
      payload: { companyId: companyA, name: 'Coca-Cola Original', brand: 'Coca-Cola', gtin: GTIN_COCA, categoryId: CAT_BEBIDAS },
    });
    const cocaId = t1.json()?.data?.canonicalProductId as string;
    record('T1 sugestão cria canônico (201, pendingCuration)', t1.statusCode === 201 && t1.json()?.data?.pendingCuration === true, `status=${t1.statusCode} body=${t1.body}`);
    const t1row = await pool.query<{ scope: string; tenant_id: string | null; concept_resolution_status: string }>(
      `SELECT scope, tenant_id, concept_resolution_status FROM canonical_products WHERE id=$1::uuid`, [cocaId]
    );
    record('T1 empresa NÃO cria global READY (scoped + unresolved + fila)',
      t1row.rows[0]?.scope === 'scoped' && t1row.rows[0]?.tenant_id === TENANT_ID && t1row.rows[0]?.concept_resolution_status === 'unresolved',
      JSON.stringify(t1row.rows[0]));
    const q1 = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM canonical_concept_resolution_queue WHERE canonical_product_id=$1::uuid AND status='pending'`, [cocaId]);
    record('T1 fila de curadoria pendente criada', q1.rows[0].n === '1', `n=${q1.rows[0].n}`);

    // ── T2: mesmo GTIN não duplica (empresa B reusa a identidade) ──
    const t2 = await app.inject({
      method: 'POST', url: '/catalog/governance/products/suggestions', headers: F2.headers,
      payload: { companyId: companyB, name: 'Coca Cola 1 Litro', brand: 'Coca-Cola', gtin: GTIN_COCA, categoryId: CAT_BEBIDAS },
    });
    record('T2 mesmo GTIN não duplica (mesma identidade)', t2.statusCode === 200 && t2.json()?.data?.canonicalProductId === cocaId && t2.json()?.data?.created === false, `body=${t2.body}`);

    // ── T3: mesmo fingerprint (nome+marca+categoria, sem GTIN) não duplica ──
    const t3a = await app.inject({
      method: 'POST', url: '/catalog/governance/products/suggestions', headers: F1.headers,
      payload: { companyId: companyA, name: 'Guaraná Antarctica', brand: 'Ambev', categoryId: CAT_BEBIDAS },
    });
    const guaranaId = t3a.json()?.data?.canonicalProductId as string;
    const t3b = await app.inject({
      method: 'POST', url: '/catalog/governance/products/suggestions', headers: F2.headers,
      payload: { companyId: companyB, name: 'Guaraná Antarctica', brand: 'Ambev', categoryId: CAT_BEBIDAS },
    });
    record('T3 mesmo fingerprint não duplica', t3b.json()?.data?.canonicalProductId === guaranaId && t3b.json()?.data?.created === false, `body=${t3b.body}`);

    // ── T4: grafia de marca normalizada não duplica (Nestlé ≈ NESTLE) ──
    const t4a = await app.inject({
      method: 'POST', url: '/catalog/governance/products/suggestions', headers: F1.headers,
      payload: { companyId: companyA, name: 'Leite Condensado Moça', brand: 'Nestlé', categoryId: CAT_BEBIDAS },
    });
    const mocaId = t4a.json()?.data?.canonicalProductId as string;
    const t4b = await app.inject({
      method: 'POST', url: '/catalog/governance/products/suggestions', headers: F2.headers,
      payload: { companyId: companyB, name: 'Leite Condensado Moça', brand: '  NESTLE ', categoryId: CAT_BEBIDAS },
    });
    record('T4 marca normalizada não duplica (Nestlé/NESTLE → 1 identidade)',
      t4b.json()?.data?.canonicalProductId === mocaId && t4b.json()?.data?.linkedToExisting === true, `body=${t4b.body}`);

    // ── T5: variantes — eixos discriminadores na identidade ──
    const mkVariant = async (h: Human, companyId: string, variant: Record<string, unknown>): Promise<{ id: string; status: number }> => {
      const r = await app.inject({
        method: 'POST', url: '/catalog/governance/products/suggestions', headers: h.headers,
        payload: { companyId, name: 'Coca-Cola Original', brand: 'Coca-Cola', gtin: GTIN_COCA, categoryId: CAT_BEBIDAS, variant },
      });
      return { id: r.json()?.data?.variant?.id as string, status: r.statusCode };
    };
    const v1L = await mkVariant(F1, companyA, {
      variantName: 'Coca-Cola Original 1L retornável', gtin: '7894900011524',
      netContentValue: 1, netContentUnit: 'l', packageType: 'garrafa', isReturnable: true,
    });
    const v1LAgain = await mkVariant(F2, companyB, {
      variantName: 'Coca 1 litro ret', gtin: '7894900011524',
      netContentValue: 1, netContentUnit: 'l', packageType: 'garrafa', isReturnable: true,
    });
    record('T5a mesma variante (GTIN) não duplica entre empresas', !!v1L.id && v1LAgain.id === v1L.id, `${v1L.id} vs ${v1LAgain.id}`);
    const v1LDesc = await mkVariant(F1, companyA, {
      variantName: 'Coca-Cola Original 1L descartável',
      netContentValue: 1, netContentUnit: 'l', packageType: 'garrafa', isReturnable: false,
    });
    record('T5b retornável ≠ descartável (variantes distintas)', !!v1LDesc.id && v1LDesc.id !== v1L.id, `${v1LDesc.id}`);
    const v2L = await mkVariant(F1, companyA, {
      variantName: 'Coca-Cola Original 2L retornável',
      netContentValue: 2, netContentUnit: 'l', packageType: 'garrafa', isReturnable: true,
    });
    record('T5c 1L ≠ 2L (variantes distintas)', !!v2L.id && v2L.id !== v1L.id && v2L.id !== v1LDesc.id, `${v2L.id}`);
    const v1LDescAgain = await mkVariant(F2, companyB, {
      variantName: 'COCA COLA ORIGINAL 1 L  DESCARTAVEL',
      netContentValue: 1, netContentUnit: 'l', packageType: 'Garrafa', isReturnable: false,
    });
    record('T5d mesmos eixos sem GTIN → dedup por fingerprint (acento/caixa-insensível)', v1LDescAgain.id === v1LDesc.id, `${v1LDescAgain.id} vs ${v1LDesc.id}`);

    // ── T6: curadoria humana — não-admin 403; admin aprova + promove a global ──
    const t6a = await app.inject({ method: 'GET', url: '/catalog/governance/curation/queue', headers: F1.headers });
    record('T6a fundador não acessa curadoria (403)', t6a.statusCode === 403, `status=${t6a.statusCode}`);
    const t6b = await app.inject({ method: 'GET', url: '/catalog/governance/curation/queue', headers: CUR.headers });
    const queueItems = (t6b.json()?.data?.products ?? []) as Array<{ canonicalProductId: string }>;
    record('T6b admin vê a fila com a sugestão', t6b.statusCode === 200 && queueItems.some((q) => q.canonicalProductId === cocaId), `n=${queueItems.length}`);
    const t6c = await app.inject({
      method: 'POST', url: `/catalog/governance/curation/products/${cocaId}/approve`, headers: CUR.headers,
      payload: { conceptId: CONCEPT_COLA, promoteToGlobal: true },
    });
    const t6row = await pool.query<{ scope: string; tenant_id: string | null; concept_resolution_status: string; concept_id: string }>(
      `SELECT scope, tenant_id, concept_resolution_status, concept_id FROM canonical_products WHERE id=$1::uuid`, [cocaId]
    );
    record('T6c curador aprova + promove → global READY (confirmed)',
      t6c.statusCode === 200 && t6row.rows[0]?.scope === 'global' && t6row.rows[0]?.tenant_id === null &&
      t6row.rows[0]?.concept_resolution_status === 'confirmed' && t6row.rows[0]?.concept_id === CONCEPT_COLA,
      `status=${t6c.statusCode} row=${JSON.stringify(t6row.rows[0])}`);
    const ev6 = await pool.query<{ n: string }>(
      `SELECT count(*)::text n FROM canonical_catalog_events WHERE entity_id=$1::uuid AND event_type='curation_approved'`, [cocaId]
    );
    record('T6d evento de curadoria registrado (append-only)', ev6.rows[0].n === '1', `n=${ev6.rows[0].n}`);

    // ── T7: produto LOCAL fica scoped, dedup local, sem GTIN ──
    const t7a = await app.inject({
      method: 'POST', url: '/catalog/governance/products/local', headers: F1.headers,
      payload: { companyId: companyA, name: 'Bolo de Pote da Casa', categoryId: CAT_BEBIDAS },
    });
    const localId = t7a.json()?.data?.canonicalProductId as string;
    record('T7a produto LOCAL criado scoped (type=LOCAL)',
      t7a.statusCode === 201 && t7a.json()?.data?.scope === 'scoped' && t7a.json()?.data?.type === 'LOCAL', `body=${t7a.body}`);
    const t7b = await app.inject({
      method: 'POST', url: '/catalog/governance/products/local', headers: F1.headers,
      payload: { companyId: companyA, name: 'Bolo de Pote da Casa', categoryId: CAT_BEBIDAS },
    });
    record('T7b LOCAL dedup local (mesmo nome → mesma identidade)', t7b.json()?.data?.canonicalProductId === localId && t7b.json()?.data?.created === false, `body=${t7b.body}`);

    // ── T8: serviço canônico compartilhado ──
    const t8a = await app.inject({ method: 'GET', url: '/catalog/governance/services/search?q=corte', headers: F1.headers });
    const corteList = (t8a.json()?.data ?? []) as Array<{ id: string; slug: string; scope: string; status: string }>;
    const corteGlobal = corteList.find((s) => s.slug === 'corte-de-cabelo-masculino');
    record('T8a serviço canônico GLOBAL seed visível (corte-de-cabelo-masculino, active)',
      !!corteGlobal && corteGlobal.scope === 'global' && corteGlobal.status === 'active', `n=${corteList.length}`);
    const t8b = await app.inject({
      method: 'POST', url: '/catalog/governance/services/suggestions', headers: F1.headers,
      payload: { companyId: companyA, name: 'Corte de Cabelo Masculino', conceptId: CONCEPT_BELEZA },
    });
    record('T8b sugerir o MESMO serviço não duplica (slug normalizado → identidade global)',
      t8b.statusCode === 200 && t8b.json()?.data?.canonicalService?.id === corteGlobal?.id && t8b.json()?.data?.created === false, `body=${t8b.body}`);
    const t8c = await app.inject({
      method: 'POST', url: '/catalog/governance/services/suggestions', headers: F2.headers,
      payload: { companyId: companyB, name: 'Banho de Lua', conceptId: CONCEPT_BELEZA, baseDurationMinutes: 60 },
    });
    const banhoId = t8c.json()?.data?.canonicalService?.id as string;
    record('T8c sugestão de serviço novo nasce pending_curation (scoped)',
      t8c.statusCode === 201 && t8c.json()?.data?.canonicalService?.status === 'pending_curation', `body=${t8c.body}`);

    // ── T9: writer de services EXIGE canônico ativo ──
    const t9a = await app.inject({
      method: 'POST', url: '/services', headers: F1.headers,
      payload: { actorId: F1.actorId, name: 'Corte sem canônico', serviceType: 'service', categoryId: CAT_CABELEIREIRO, priceCents: 4000 },
    });
    record('T9a service SEM canonicalServiceId → bloqueado (400)', t9a.statusCode === 400 && /canonicalServiceId/.test(t9a.body), `status=${t9a.statusCode}`);
    const t9b = await app.inject({
      method: 'POST', url: '/services', headers: F2.headers,
      payload: { actorId: F2.actorId, name: 'Banho de Lua da B', serviceType: 'service', categoryId: CAT_CABELEIREIRO, canonicalServiceId: banhoId, priceCents: 9000 },
    });
    record('T9b canônico pending_curation → bloqueado (não curado)', t9b.statusCode === 400 && /não curado|NOT_ACTIVE|curado/i.test(t9b.body), `status=${t9b.statusCode} body=${t9b.body.slice(0, 160)}`);
    const t9c = await app.inject({
      method: 'POST', url: '/services', headers: F1.headers,
      payload: { actorId: F1.actorId, name: 'Corte Premium do Fundador', serviceType: 'service', categoryId: CAT_CABELEIREIRO, canonicalServiceId: corteGlobal!.id, priceCents: 5000 },
    });
    record('T9c prestador 1 cria service referenciando canônico ativo (201)', t9c.statusCode === 201 && t9c.json()?.data?.canonicalServiceId === corteGlobal!.id, `status=${t9c.statusCode}`);
    const t9d = await app.inject({
      method: 'POST', url: '/services', headers: P2.headers,
      payload: { actorId: P2.actorId, name: 'Corte Clássico do Segundo', serviceType: 'service', categoryId: CAT_CABELEIREIRO, canonicalServiceId: corteGlobal!.id, priceCents: 3500 },
    });
    record('T9d prestador 2 usa o MESMO canônico (sem duplicar significado)', t9d.statusCode === 201 && t9d.json()?.data?.canonicalServiceId === corteGlobal!.id, `status=${t9d.statusCode}`);
    const sameCanon = await pool.query<{ n: string }>(
      `SELECT count(DISTINCT canonical_service_id)::text n FROM services WHERE tenant_id=$1 AND canonical_service_id IS NOT NULL`, [TENANT_ID]
    );
    record('T9e N prestadores → 1 identidade canônica de serviço', sameCanon.rows[0].n === '1', `distintos=${sameCanon.rows[0].n}`);

    // ── T10: merge preserva referências (redirect, append-only, idempotente) ──
    const dupSug = await app.inject({
      method: 'POST', url: '/catalog/governance/products/suggestions', headers: F2.headers,
      payload: { companyId: companyB, name: 'Coca Cola Original Tradicional', brand: 'Coca Cola', categoryId: CAT_BEBIDAS },
    });
    const dupId = dupSug.json()?.data?.canonicalProductId as string;
    const t10a = await app.inject({
      method: 'POST', url: '/catalog/governance/curation/products/merge', headers: CUR.headers,
      payload: { duplicateId: dupId, winnerId: cocaId },
    });
    const { catalogCurationService } = await import('../core/catalog/curation/catalog-curation.service');
    const resolved = await catalogCurationService.resolveProductRedirect(dupId);
    record('T10a merge curatorial: duplicata resolve para o vencedor', t10a.statusCode === 200 && resolved === cocaId, `resolved=${resolved}`);
    const t10b = await app.inject({
      method: 'POST', url: '/catalog/governance/curation/products/merge', headers: CUR.headers,
      payload: { duplicateId: dupId, winnerId: cocaId },
    });
    record('T10b merge idempotente (repetir → ok, sem efeito novo)', t10b.statusCode === 200, `status=${t10b.statusCode}`);
    const dupRow = await pool.query<{ name: string; duplicate_of_canonical_product_id: string }>(
      `SELECT name, duplicate_of_canonical_product_id FROM canonical_products WHERE id=$1::uuid`, [dupId]
    );
    record('T10c história preservada (linha original intacta + redirect)',
      dupRow.rows[0]?.name === 'Coca Cola Original Tradicional' && dupRow.rows[0]?.duplicate_of_canonical_product_id === cocaId,
      JSON.stringify(dupRow.rows[0]));
    const t10d = await app.inject({
      method: 'POST', url: '/catalog/governance/curation/products/merge', headers: F1.headers,
      payload: { duplicateId: dupId, winnerId: cocaId },
    });
    record('T10d merge é curatorial (não-admin → 403)', t10d.statusCode === 403, `status=${t10d.statusCode}`);

    // ── T11: unidades fail-closed ──
    const { canonicalUnitsService, CanonicalUnitError } = await import('../core/catalog/canonical/canonical-units.service');
    const okSum = await canonicalUnitsService.sumQuantitiesStrict([{ quantity: 2, unit: 'kg' }, { quantity: 3, unit: 'kg' }]);
    record('T11a mesma unidade soma (kg+kg=5kg)', okSum?.total === 5 && okSum?.unit === 'kg', JSON.stringify(okSum));
    const expectUnitError = async (parts: Array<{ quantity: number; unit: string }>, code: string): Promise<boolean> => {
      try {
        await canonicalUnitsService.sumQuantitiesStrict(parts);
        return false;
      } catch (e) {
        return e instanceof CanonicalUnitError && e.code === code;
      }
    };
    record('T11b kg + un NÃO soma (UNIT_INCOMPATIBLE)', await expectUnitError([{ quantity: 1, unit: 'kg' }, { quantity: 1, unit: 'un' }], 'UNIT_INCOMPATIBLE'));
    record('T11c litro + garrafa NÃO soma (UNIT_INCOMPATIBLE)', await expectUnitError([{ quantity: 1, unit: 'l' }, { quantity: 1, unit: 'garrafa' }], 'UNIT_INCOMPATIBLE'));
    record('T11d unidade desconhecida falha fechado (UNIT_UNKNOWN)', await expectUnitError([{ quantity: 1, unit: 'xyz' }], 'UNIT_UNKNOWN'));
    const t11e = await app.inject({
      method: 'POST', url: '/catalog/governance/products/suggestions', headers: F1.headers,
      payload: {
        companyId: companyA, name: 'Produto Unidade Fantasma', brand: 'X', categoryId: CAT_BEBIDAS,
        variant: { variantName: 'V fantasma', netContentValue: 1, netContentUnit: 'fardo-magico' },
      },
    });
    record('T11e variante com unidade fora do registry → 422 fail-closed', t11e.statusCode === 422 && /UNIT_UNKNOWN/.test(t11e.body), `status=${t11e.statusCode}`);

    // ── T12: zero actor cure + zero Bank writer ──
    const actorsBefore = await actorCount();
    const t12a = await app.inject({
      method: 'POST', url: '/catalog/governance/products/suggestions', headers: NA.headers,
      payload: { companyId: companyA, name: 'Produto do Sem Actor', categoryId: CAT_BEBIDAS },
    });
    const actorsAfter = await actorCount();
    record('T12a usuário SEM actor → 403 CATALOG_SUGGEST_ACTOR_MISSING (sem cura)',
      t12a.statusCode === 403 && /CATALOG_SUGGEST_ACTOR_MISSING/.test(t12a.body) && actorsAfter === actorsBefore,
      `status=${t12a.statusCode} actors ${actorsBefore}→${actorsAfter}`);
    const econAfter = await econSnapshot();
    record('T12b zero Bank writer / zero inventory na fundação inteira', econBefore === econAfter, `${econBefore} vs ${econAfter}`);
  } finally {
    await app.close();
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
  console.log('✨ Fundação canônica e governança — verde.');
  process.exit(0); // CLI validator: encerra o event loop (handles transitivas de módulos importados)
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
