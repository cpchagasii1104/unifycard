/**
 * E2E — EVENT-ENGINE-COMPLETION · C1b/C1c-a — EXPOSIÇÃO HTTP dos FACETS de GÊNERO + EQUIPAMENTO da oferta.
 * Prova, por HTTP REAL (app.inject — "a verdade vive no backend"), que as rotas THIN recém-adicionadas
 * a service-offerings.routes.ts apenas EXPÕEM os métodos SELADOS (tagOfferingGenres/untagOfferingGenre/
 * listOfferingGenres + equivalentes de equipamento) sem burlar autoridade nem governança.
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-offering-facet-routes-ephemeral.ps1. NUNCA unificard_dev.
 *
 * PROVAS:
 *  (1) DONO taggeia um GÊNERO governado na PRÓPRIA oferta → 201; GET lista o gênero.
 *  (2) DONO taggeia um EQUIPAMENTO governado (use-area de palco) → 201; GET lista o equipamento.
 *  (3) DONO destaggeia (DELETE) → 200; GET não lista mais.
 *  (4) NÃO-DONO taggeia/destaggeia → 403 (fronteira de autoridade — asserção load-bearing).
 *  (5) DONO taggeia GÊNERO/EQUIPAMENTO NÃO-GOVERNADO (uuid solto) → 422 (governança enforçada pelo
 *      SERVICE selado, não burlada pela rota).
 *  (6) Δbank=0.
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
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/offering|facet|genre|equipment|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
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
  const { default: serviceOfferingsRoutes } = await import('../modules/services/service-offerings.routes');
  await app.register(serviceOfferingsRoutes, { prefix: '/services' });
  await app.ready();
  return app;
}

interface Human { globalId: string; userId: string; actorId: string; headers: Record<string, string> }

const count = async (sql: string, p: unknown[] = []): Promise<number> =>
  Number((await pool.query<{ n: string }>(sql, p)).rows[0].n);

async function main(): Promise<void> {
  await assertEphemeralDb();
  await bootstrapSocialPorts();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Offering Facet Routes E2E', slug: `facet-routes-${Date.now()}` });
  await rbacService.seedDefaultRBAC(TENANT_ID);

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const actorRepo = socialPortsRegistry.getActorRepository();

  let cpfSeq = Date.now() % 100000000;
  const mkHuman = async (name: string): Promise<Human> => {
    const globalId = randomUUID();
    const userId = randomUUID();
    const cpf = String(cpfSeq++).padStart(11, '0').slice(-11);
    await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,$3,'{}'::jsonb)`, [globalId, cpf, name]);
    await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [globalId, cpf]);
    await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`, [userId, TENANT_ID, globalId, `${userId}@e2e.local`]);
    const actorId = (await actorRepo.findOrCreateUserActor(TENANT_ID, userId)).actor_id;
    const token = jwt.sign(
      { sub: userId, userId, tenantId: TENANT_ID, email: `${userId}@e2e.local`, tokenVersion: 0, globalUserId: globalId, type: 'access' },
      JWT_SECRET as string,
      { expiresIn: '15m' }
    );
    const ac = JSON.stringify({ actorId, intent: 'offering_facet_e2e', source: 'e2e', scope: `tenant:${TENANT_ID}` });
    return { globalId, userId, actorId, headers: { authorization: `Bearer ${token}`, 'x-action-context': ac } };
  };

  const P1 = await mkHuman('E2E Provider (dono da oferta)');
  const P2 = await mkHuman('E2E Stranger (não-dono)');

  // ── FIXTURE de oferta ativa do provider P1 (apresentação musical). Cadeia canonical_services → services →
  // service_offerings (mesmo padrão do E2E de availability-owner-authority). Facet não exige o tipo musical,
  // mas usamos apresentacao-musical por fidelidade semântica (gênero/equipamento).
  const canonicalServiceId = (await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM canonical_services WHERE scope='global' AND slug='apresentacao-musical' AND status='active' LIMIT 1`
  )).rows[0]?.id;
  if (!canonicalServiceId) throw new Error('canonical_service global apresentacao-musical ausente no seed FULL.');
  const serviceId = (await pool.query<{ id: string }>(
    `INSERT INTO services (tenant_id, actor_id, name, slug, canonical_service_id) VALUES ($1::uuid, $2::uuid, 'Show Facet E2E', $3, $4::uuid)
     RETURNING service_id::text AS id`,
    [TENANT_ID, P1.actorId, `svc-facet-${Date.now()}`, canonicalServiceId])).rows[0].id;
  const offeringId = (await pool.query<{ id: string }>(
    `INSERT INTO service_offerings (tenant_id, canonical_service_id, service_id, provider_actor_id, price_cents, duration_minutes, modality, status)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 250000, 90, 'in_person', 'active')
     RETURNING id::text AS id`,
    [TENANT_ID, canonicalServiceId, serviceId, P1.actorId])).rows[0].id;

  // Gênero GOVERNADO (shared_subject_concepts habilitado) + equipamento GOVERNADO (use-area de palco/evento).
  const genreConceptId = (await pool.query<{ id: string }>(
    `SELECT concept_id::text AS id FROM shared_subject_concepts WHERE enabled = true ORDER BY created_at ASC LIMIT 1`
  )).rows[0]?.id;
  if (!genreConceptId) throw new Error('nenhum shared_subject_concept habilitado no seed FULL.');
  const equipmentConceptId = (await pool.query<{ id: string }>(
    `SELECT DISTINCT c.concept_id::text AS id
       FROM concepts c
       JOIN rental_equipment_use_area_concepts ruac ON ruac.concept_id = c.concept_id
       JOIN rental_equipment_use_areas ua ON ua.id = ruac.use_area_id
      WHERE ua.code IN ('audio_video_lighting','events_parties') ORDER BY 1 LIMIT 1`
  )).rows[0]?.id;
  if (!equipmentConceptId) throw new Error('nenhum concept de equipamento de palco/evento no seed FULL.');

  const bank0 = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`);

  const app = await buildApp();
  const base = `/services/offerings/${offeringId}`;

  try {
    // ═══ (1) GÊNERO: dono tagueia → 201; GET lista ═══════════════════════════════
    const tagG = await app.inject({ method: 'POST', url: `${base}/genres`, headers: P1.headers, payload: { subjectConceptIds: [genreConceptId] } });
    record('(1a) DONO tagueia gênero governado → 201', tagG.statusCode === 201, `status=${tagG.statusCode} ${tagG.body}`);
    const getG = await app.inject({ method: 'GET', url: `${base}/genres`, headers: P1.headers });
    record('(1b) GET /genres lista o gênero taggeado', getG.statusCode === 200 && (getG.json()?.data ?? []).includes(genreConceptId),
      `status=${getG.statusCode} data=${JSON.stringify(getG.json()?.data)}`);

    // ═══ (2) EQUIPAMENTO: dono tagueia → 201; GET lista ══════════════════════════
    const tagE = await app.inject({ method: 'POST', url: `${base}/equipment`, headers: P1.headers, payload: { equipmentConceptIds: [equipmentConceptId] } });
    record('(2a) DONO tagueia equipamento governado → 201', tagE.statusCode === 201, `status=${tagE.statusCode} ${tagE.body}`);
    const getE = await app.inject({ method: 'GET', url: `${base}/equipment`, headers: P1.headers });
    record('(2b) GET /equipment lista o equipamento taggeado', getE.statusCode === 200 && (getE.json()?.data ?? []).includes(equipmentConceptId),
      `status=${getE.statusCode} data=${JSON.stringify(getE.json()?.data)}`);

    // ═══ (3) DESTAG: dono remove → 200; GET não lista mais ═══════════════════════
    const delG = await app.inject({ method: 'DELETE', url: `${base}/genres/${genreConceptId}`, headers: P1.headers });
    const getG2 = await app.inject({ method: 'GET', url: `${base}/genres`, headers: P1.headers });
    record('(3) DONO destaggeia gênero → 200 e GET não lista mais',
      delG.statusCode === 200 && !((getG2.json()?.data ?? []).includes(genreConceptId)),
      `del=${delG.statusCode} data=${JSON.stringify(getG2.json()?.data)}`);

    // ═══ (4) NÃO-DONO: tag/untag → 403 (fronteira de autoridade — load-bearing) ══
    const tagByStranger = await app.inject({ method: 'POST', url: `${base}/genres`, headers: P2.headers, payload: { subjectConceptIds: [genreConceptId] } });
    const untagByStranger = await app.inject({ method: 'DELETE', url: `${base}/equipment/${equipmentConceptId}`, headers: P2.headers });
    const tagEqByStranger = await app.inject({ method: 'POST', url: `${base}/equipment`, headers: P2.headers, payload: { equipmentConceptIds: [equipmentConceptId] } });
    record('(4) NÃO-DONO tag gênero / untag equip / tag equip → 403 SERVICE_OFFERING_NOT_REPRESENTABLE (×3)',
      tagByStranger.statusCode === 403 && tagByStranger.json()?.code === 'SERVICE_OFFERING_NOT_REPRESENTABLE'
      && untagByStranger.statusCode === 403 && tagEqByStranger.statusCode === 403,
      `${tagByStranger.statusCode}:${tagByStranger.json()?.code} · ${untagByStranger.statusCode} · ${tagEqByStranger.statusCode}`);
    // prova de que o não-dono NÃO conseguiu remover o equipamento do dono
    const getE2 = await app.inject({ method: 'GET', url: `${base}/equipment`, headers: P1.headers });
    record('(4b) equipamento do dono INTACTO após tentativa do não-dono', (getE2.json()?.data ?? []).includes(equipmentConceptId),
      `data=${JSON.stringify(getE2.json()?.data)}`);

    // ═══ (5) GOVERNANÇA no service, não burlada pela rota: uuid solto → 422 ══════
    const ungovernedGenre = await app.inject({ method: 'POST', url: `${base}/genres`, headers: P1.headers, payload: { subjectConceptIds: [randomUUID()] } });
    record('(5a) DONO tagueia gênero NÃO-GOVERNADO → 422 SERVICE_OFFERING_GENRE_NOT_GOVERNED',
      ungovernedGenre.statusCode === 422 && ungovernedGenre.json()?.code === 'SERVICE_OFFERING_GENRE_NOT_GOVERNED',
      `status=${ungovernedGenre.statusCode} code=${ungovernedGenre.json()?.code}`);
    const ungovernedEquip = await app.inject({ method: 'POST', url: `${base}/equipment`, headers: P1.headers, payload: { equipmentConceptIds: [randomUUID()] } });
    record('(5b) DONO tagueia equipamento NÃO-GOVERNADO → 422 SERVICE_OFFERING_EQUIPMENT_NOT_GOVERNED',
      ungovernedEquip.statusCode === 422 && ungovernedEquip.json()?.code === 'SERVICE_OFFERING_EQUIPMENT_NOT_GOVERNED',
      `status=${ungovernedEquip.statusCode} code=${ungovernedEquip.json()?.code}`);

    // ═══ (6) Δbank=0 ═════════════════════════════════════════════════════════════
    record('(6) Δbank=0 — facet não move dinheiro',
      (await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`)) === bank0);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Exposição HTTP dos facets de gênero/equipamento (thin, owner-gated, governança no service) — verde.');
  process.exit(0);
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
