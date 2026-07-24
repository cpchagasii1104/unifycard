/**
 * E2E — SLICE-2A (EVENT-ENGINE · "catálogo Netflix" visível) — DISCOVERY BY GENRE over HTTP.
 * Prova, por HTTP REAL (app.inject — "a verdade vive no backend"), que GET /services/discover agora EXPÕE
 * na querystring os filtros JÁ SELADOS da camada de serviço (C1b subject_concept_id / C1c-a
 * equipment_concept_id / F-PERFORMER-AUDIENCE-RANGE audience_size) como pass-through FINO — sem
 * reimplementar matching (a verdade segue em discoverServices, selada).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-discover-by-genre-http-ephemeral.ps1. NUNCA unificard_dev.
 *
 * PROVAS:
 *  (1) performer com oferta ATIVA taggeada com GÊNERO A + faixa [100,2000] + disponibilidade futura:
 *      ?subject_concept_id=A ENCONTRA o serviço; ?subject_concept_id=B (outro gênero governado) NÃO.
 *  (2) ?audience_size=500 (dentro da faixa) ENCONTRA; ?audience_size=5000 (fora) NÃO.
 *  (3) combinado gênero+audience+city: A+500+CITY ENCONTRA; A+500+outra city NÃO.
 *  (4) equipamento: ?equipment_concept_id taggeado ENCONTRA; equipamento governado NÃO-taggeado NÃO.
 *  (5) parse fino fail-closed: subject_concept_id não-uuid → 400; audience_size 0/negativo/não-inteiro → 400.
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
import { professionalC1Service } from '../core/profile/professional-c1/professional-c1.service';
import { servicesService } from '../modules/services/services.service';
import { serviceOfferingService } from '../modules/services/service-offering.service';
import { ServiceType, ServiceStatus } from '../modules/services/services.types';

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
  if (!/discover|genre|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
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
  const { default: servicesRoutes } = await import('../modules/services/services.routes');
  await app.register(servicesRoutes, { prefix: '/services' });
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
  await tenantService.createTenant({ id: TENANT_ID, name: 'Discover By Genre HTTP E2E', slug: `discover-genre-${Date.now()}` });
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
    const ac = JSON.stringify({ actorId, intent: 'discover_genre_e2e', source: 'e2e', scope: `tenant:${TENANT_ID}` });
    return { globalId, userId, actorId, headers: { authorization: `Bearer ${token}`, 'x-action-context': ac } };
  };

  const BAND = await mkHuman('E2E Banda (dona da oferta)');
  const VIEWER = await mkHuman('E2E Consumidor (descoberta)');
  const CITY = randomUUID();
  const OTHER_CITY = randomUUID();

  // ── FIXTURE via WRITERS SELADOS (mesma cadeia do E2E audience-range): declareConcept →
  // createService(active) → createOffering(faixa [100,2000]) → active → declareAvailability futura →
  // tagOfferingGenres(GÊNERO A) + tagOfferingEquipment(EQUIP A).
  const musical = (await pool.query<{ concept_id: string; canonical_id: string }>(
    `SELECT c.concept_id::text AS concept_id, cs.id::text AS canonical_id
       FROM concepts c
       JOIN canonical_services cs ON cs.concept_id = c.concept_id AND cs.tenant_id IS NULL AND cs.scope='global' AND cs.status='active'
      WHERE c.slug = 'apresentacao-musical'`
  )).rows[0];
  if (!musical) throw new Error('concept apresentacao-musical ausente no seed FULL.');

  const genres = (await pool.query<{ id: string }>(
    `SELECT concept_id::text AS id FROM shared_subject_concepts WHERE enabled = true ORDER BY created_at ASC LIMIT 2`
  )).rows.map((r) => r.id);
  if (genres.length < 2) throw new Error('preciso de ≥2 shared_subject_concepts habilitados no seed FULL.');
  const [GENRE_A, GENRE_B] = genres;

  const equips = (await pool.query<{ id: string }>(
    `SELECT DISTINCT c.concept_id::text AS id
       FROM concepts c
       JOIN rental_equipment_use_area_concepts ruac ON ruac.concept_id = c.concept_id
       JOIN rental_equipment_use_areas ua ON ua.id = ruac.use_area_id
      WHERE ua.code IN ('audio_video_lighting','events_parties') ORDER BY 1 LIMIT 2`
  )).rows.map((r) => r.id);
  if (equips.length < 2) throw new Error('preciso de ≥2 concepts de equipamento de palco/evento no seed FULL.');
  const [EQUIP_A, EQUIP_B] = equips;

  await professionalC1Service.declareConcept(TENANT_ID, BAND.actorId, { conceptId: musical.concept_id, skillLevel: 3 }, BAND.userId);
  const service = await servicesService.createService(TENANT_ID, BAND.userId, {
    actorId: BAND.actorId, name: 'Show ao vivo — Discover By Genre E2E', serviceType: ServiceType.SERVICE,
    status: ServiceStatus.ACTIVE, canonicalServiceId: musical.canonical_id, cityId: CITY,
  });
  const { offering } = await serviceOfferingService.createOffering({
    tenantId: TENANT_ID, userId: BAND.userId, providerActorId: BAND.actorId,
    canonicalServiceId: musical.canonical_id, priceCents: 250000, durationMinutes: 90,
    audienceMin: 100, audienceMax: 2000,
  });
  await serviceOfferingService.updateOwnOffering({ tenantId: TENANT_ID, userId: BAND.userId, offeringId: offering.id, status: 'active' });
  const start = new Date(Date.now() + 7 * 24 * 3600e3);
  const end = new Date(Date.now() + 7 * 24 * 3600e3 + 2 * 3600e3);
  await serviceOfferingService.declareAvailability({ tenantId: TENANT_ID, userId: BAND.userId, offeringId: offering.id, startDatetime: start.toISOString(), endDatetime: end.toISOString() });
  await serviceOfferingService.tagOfferingGenres({ tenantId: TENANT_ID, userId: BAND.userId, offeringId: offering.id, subjectConceptIds: [GENRE_A] });
  await serviceOfferingService.tagOfferingEquipment({ tenantId: TENANT_ID, userId: BAND.userId, offeringId: offering.id, equipmentConceptIds: [EQUIP_A] });

  const bank0 = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`);

  const app = await buildApp();

  const discover = async (qs: string): Promise<{ status: number; ids: string[] }> => {
    const res = await app.inject({ method: 'GET', url: `/services/discover?${qs}`, headers: VIEWER.headers });
    const body = res.json();
    const ids = Array.isArray(body?.data) ? body.data.map((s: { serviceId: string }) => s.serviceId) : [];
    return { status: res.statusCode, ids };
  };
  const SID = service.serviceId;

  try {
    // ═══ (1) GÊNERO na querystring: A encontra; B (outro gênero governado) não ═══
    const byA = await discover(`subject_concept_id=${GENRE_A}`);
    const byB = await discover(`subject_concept_id=${GENRE_B}`);
    record('(1) ?subject_concept_id=GÊNERO_A ENCONTRA · GÊNERO_B NÃO',
      byA.status === 200 && byA.ids.includes(SID) && byB.status === 200 && !byB.ids.includes(SID),
      `A: ${byA.status}/${byA.ids.includes(SID)} · B: ${byB.status}/${byB.ids.includes(SID)}`);

    // ═══ (2) AUDIENCE_SIZE: 500 (dentro de [100,2000]) encontra; 5000 (fora) não ═══
    const in500 = await discover(`audience_size=500`);
    const out5000 = await discover(`audience_size=5000`);
    record('(2) ?audience_size=500 (dentro da faixa) ENCONTRA · 5000 (fora) NÃO',
      in500.status === 200 && in500.ids.includes(SID) && out5000.status === 200 && !out5000.ids.includes(SID),
      `500: ${in500.status}/${in500.ids.includes(SID)} · 5000: ${out5000.status}/${out5000.ids.includes(SID)}`);

    // ═══ (3) COMBINADO gênero+audience+city ═══
    const combo = await discover(`subject_concept_id=${GENRE_A}&audience_size=500&city_id=${CITY}`);
    const comboWrongCity = await discover(`subject_concept_id=${GENRE_A}&audience_size=500&city_id=${OTHER_CITY}`);
    record('(3) combinado gênero+audience+city ENCONTRA · mesma query com OUTRA city NÃO',
      combo.status === 200 && combo.ids.includes(SID) && comboWrongCity.status === 200 && !comboWrongCity.ids.includes(SID),
      `combo: ${combo.status}/${combo.ids.includes(SID)} · wrongCity: ${comboWrongCity.status}/${comboWrongCity.ids.includes(SID)}`);

    // ═══ (4) EQUIPAMENTO: taggeado encontra; governado NÃO-taggeado não ═══
    const byEqA = await discover(`equipment_concept_id=${EQUIP_A}`);
    const byEqB = await discover(`equipment_concept_id=${EQUIP_B}`);
    record('(4) ?equipment_concept_id taggeado ENCONTRA · equipamento não-taggeado NÃO',
      byEqA.status === 200 && byEqA.ids.includes(SID) && byEqB.status === 200 && !byEqB.ids.includes(SID),
      `EqA: ${byEqA.status}/${byEqA.ids.includes(SID)} · EqB: ${byEqB.status}/${byEqB.ids.includes(SID)}`);

    // ═══ (5) PARSE FINO fail-closed → 400 ═══
    const badUuid = await discover(`subject_concept_id=nao-e-uuid`);
    const badEqUuid = await discover(`equipment_concept_id=123`);
    const zero = await discover(`audience_size=0`);
    const neg = await discover(`audience_size=-5`);
    const float = await discover(`audience_size=1.5`);
    const nan = await discover(`audience_size=abc`);
    record('(5) parse fino: uuid inválido (×2) → 400 · audience_size 0/-5/1.5/abc → 400',
      badUuid.status === 400 && badEqUuid.status === 400 && zero.status === 400 && neg.status === 400 && float.status === 400 && nan.status === 400,
      `uuid=${badUuid.status},${badEqUuid.status} size=${zero.status},${neg.status},${float.status},${nan.status}`);

    // ═══ (6) Δbank=0 ═══
    record('(6) Δbank=0 — descoberta não move dinheiro',
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
  console.log('✨ Discovery by genre/equipment/audience por HTTP (exposição thin dos filtros selados) — verde.');
  process.exit(0);
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
