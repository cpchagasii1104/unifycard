/**
 * E2E — DECISION-0118 D2 (F-CANONICAL-CONTEXTUAL-MEDIA-AND-TEMPORAL-AUTHORITY-CLOSURE).
 * Vetor [B2] do reseal Yala (RESOURCE-OWNER-AUTHORITY-CONFLATION) como prova permanente.
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-availability-owner-authority-ephemeral.ps1.
 *
 * Prova (GO §12/§13):
 *   - SERVICE_OFFERING ponta a ponta por HTTP REAL: prestador cria janela (201),
 *     relê, lista, atualiza, pausa/reativa, recebe booking, lista bookings,
 *     confirma, check-in, check-out — a availability NÃO é mais write-only;
 *   - prestador ESTRANHO: não lê, não lista, não atualiza, não confirma (403);
 *   - owner_id inexistente → 404; owner_type incompatível com owner_id → 404
 *     (UUID coincidente JAMAIS autoriza); actor alheio no body → 403; zero cura;
 *   - offering.id NUNCA precisa existir em actors (prova material);
 *   - REGRESSÃO dos demais owner types vivos (user/page/service/event/group):
 *     dono funciona; estranho falha; tipo trocado falha;
 *   - CHECK físico de owner_type rejeita tipo fora do vocabulário;
 *   - zero Bank writer; zero estado parcial.
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
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/availability|owner|authority|temporal|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
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
  const { unifiedAvailabilityRoutes } = await import('../core/availability/unified-availability.routes');
  await app.register(unifiedAvailabilityRoutes, { prefix: '/availability' });
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

const count = async (sql: string, p: unknown[] = []): Promise<number> =>
  Number((await pool.query<{ n: string }>(sql, p)).rows[0].n);

async function main(): Promise<void> {
  await assertEphemeralDb();
  await bootstrapSocialPorts();

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Owner Authority Test', slug: `owner-auth-${Date.now()}` });
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
    const ac = JSON.stringify({ actorId, intent: 'owner_auth_e2e', source: 'e2e', scope: `tenant:${TENANT_ID}` });
    return { globalId, userId, actorId, headers: { authorization: `Bearer ${token}`, 'x-action-context': ac } };
  };
  const withCtx = (h: Human, actorId: string): Record<string, string> => ({
    ...h.headers,
    'x-action-context': JSON.stringify({ actorId, intent: 'owner_auth_e2e', source: 'e2e', scope: `tenant:${TENANT_ID}` }),
  });

  const P1 = await mkHuman('E2E Provider P1');
  const P2 = await mkHuman('E2E Stranger P2');

  const app = await buildApp();

  // ── FIXTURES de recursos owner (cada um com autoridade material de P1) ──────
  const offeringId = (await pool.query<{ id: string }>(
    `INSERT INTO service_offerings (tenant_id, canonical_service_id, provider_actor_id, price_cents, duration_minutes, modality, status)
     SELECT $1::uuid, id, $2::uuid, 5000, 45, 'in_person', 'active' FROM canonical_services WHERE scope='global' AND slug='corte-de-cabelo-masculino' LIMIT 1
     RETURNING id::text AS id`,
    [TENANT_ID, P1.actorId])).rows[0].id;
  const serviceId = (await pool.query<{ id: string }>(
    `INSERT INTO services (tenant_id, actor_id, name, slug) VALUES ($1::uuid, $2::uuid, 'Svc Owner Auth', $3)
     RETURNING service_id::text AS id`,
    [TENANT_ID, P1.actorId, `svc-owner-auth-${Date.now()}`])).rows[0].id;
  const eventId = (await pool.query<{ id: string }>(
    `INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title) VALUES ($1::uuid, $2::uuid, 'user', 'meetup', 'Evento Owner Auth')
     RETURNING id::text AS id`,
    [TENANT_ID, P1.actorId])).rows[0].id;
  const groupId = (await pool.query<{ id: string }>(
    `INSERT INTO groups (tenant_id, name, owner_actor_id) VALUES ($1::uuid, 'Grupo Owner Auth', $2::uuid)
     RETURNING id::text AS id`,
    [TENANT_ID, P1.actorId])).rows[0].id;
  // page actor de empresa gerida por P1 (canRepresentActor via canManageCompany).
  const companyR = await app.inject({
    method: 'POST', url: '/companies', headers: P1.headers,
    payload: { cnpj: makeValidCnpj(85000001), companyName: 'E2E Owner Auth Co', role: 'owner', fetchFromRevenue: false },
  });
  const companyId = companyR.json()?.company?.companyId as string;
  // o NASCIMENTO da empresa já materializa o page actor (uq_actors_company_page) — usa o vivo.
  const pageActorId = (await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM actors WHERE tenant_id = $1::uuid AND company_id = $2::uuid AND actor_type = 'page' LIMIT 1`,
    [TENANT_ID, companyId])).rows[0].id;

  const bank0 = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`);
  const actorsAfterFixtures = await count(`SELECT count(*)::text n FROM actors WHERE tenant_id=$1::uuid`, [TENANT_ID]);

  const T0 = Date.parse('2026-07-01T09:00:00.000Z');
  let slot = 0;
  const win = (): { startDatetime: string; endDatetime: string } => {
    slot += 1;
    return {
      startDatetime: new Date(T0 + slot * 3600_000).toISOString(),
      endDatetime: new Date(T0 + slot * 3600_000 + 1800_000).toISOString(),
    };
  };

  const createAvail = async (h: Human, ctxActor: string, ownerType: string, ownerId: string): Promise<{ status: number; id?: string; code?: string }> => {
    const r = await app.inject({
      method: 'POST', url: '/availability', headers: withCtx(h, ctxActor),
      payload: { ownerType, ownerId, ...win(), timezone: 'America/Sao_Paulo' },
    });
    const body = r.json();
    return { status: r.statusCode, id: body?.data?.availabilityId, code: body?.code };
  };

  try {
    // ═══ §12 — SERVICE_OFFERING PONTA A PONTA (HTTP real) ═════════════════════
    const so1 = await createAvail(P1, P1.actorId, 'service_offering', offeringId);
    record('SO1 prestador cria availability da OFERTA → 201 (não mais write-only)', so1.status === 201 && !!so1.id, `status=${so1.status} ${so1.code ?? ''}`);
    const soAvailId = so1.id as string;

    const get1 = await app.inject({ method: 'GET', url: `/availability/${soAvailId}`, headers: P1.headers });
    record('SO2 prestador RELÊ a janela (200)', get1.statusCode === 200 && get1.json()?.data?.ownerType === 'service_offering', `status=${get1.statusCode}`);

    const list1 = await app.inject({ method: 'GET', url: `/availability?ownerType=service_offering&ownerId=${offeringId}`, headers: P1.headers });
    record('SO3 prestador LISTA por owner (200, ≥1 janela)', list1.statusCode === 200 && (list1.json()?.data ?? []).length >= 1, `status=${list1.statusCode}`);

    const upd1 = await app.inject({ method: 'PUT', url: `/availability/${soAvailId}`, headers: P1.headers, payload: { capacity: 3 } });
    record('SO4 prestador ATUALIZA (200)', upd1.statusCode === 200 && upd1.json()?.data?.capacity === 3, `status=${upd1.statusCode}`);

    const pause = await app.inject({ method: 'PUT', url: `/availability/${soAvailId}`, headers: P1.headers, payload: { status: 'paused' } });
    const reactivate = await app.inject({ method: 'PUT', url: `/availability/${soAvailId}`, headers: P1.headers, payload: { status: 'active' } });
    record('SO5 prestador PAUSA e REATIVA (lifecycle gerenciável)', pause.statusCode === 200 && reactivate.statusCode === 200, `${pause.statusCode}/${reactivate.statusCode}`);

    // booking do cliente (P2 como requester legítimo) + gestão pelo prestador
    const bk = await app.inject({
      method: 'POST', url: '/availability/bookings', headers: P2.headers,
      payload: { availabilityId: soAvailId, requesterActorId: P2.actorId },
    });
    const bookingId = bk.json()?.bookingId as string;
    record('SO6 cliente reserva a janela da oferta (201)', bk.statusCode === 201 && !!bookingId, `status=${bk.statusCode}`);

    const bkList = await app.inject({ method: 'GET', url: `/availability/bookings?availabilityId=${soAvailId}`, headers: P1.headers });
    record('SO7 prestador LISTA bookings da oferta (200, 1)', bkList.statusCode === 200 && (bkList.json()?.data ?? []).length === 1, `status=${bkList.statusCode}`);

    const confirm = await app.inject({ method: 'PUT', url: `/availability/bookings/${bookingId}`, headers: P1.headers, payload: { status: 'confirmed' } });
    record('SO8 prestador CONFIRMA (autoridade polimórfica do owner-recurso)', confirm.statusCode === 200, `status=${confirm.statusCode} ${confirm.body}`);
    const checkin = await app.inject({ method: 'POST', url: `/availability/bookings/${bookingId}/check-in`, headers: P1.headers, payload: {} });
    const checkout = await app.inject({ method: 'POST', url: `/availability/bookings/${bookingId}/check-out`, headers: P1.headers, payload: {} });
    record('SO9 prestador CHECK-IN e CHECK-OUT (200)', checkin.statusCode === 200 && checkout.statusCode === 200, `${checkin.statusCode}/${checkout.statusCode}`);

    // ── prestador ESTRANHO: nenhuma superfície ──────────────────────────────
    const g2 = await app.inject({ method: 'GET', url: `/availability/${soAvailId}`, headers: P2.headers });
    const l2 = await app.inject({ method: 'GET', url: `/availability?ownerType=service_offering&ownerId=${offeringId}`, headers: P2.headers });
    const u2 = await app.inject({ method: 'PUT', url: `/availability/${soAvailId}`, headers: P2.headers, payload: { capacity: 9 } });
    const bl2 = await app.inject({ method: 'GET', url: `/availability/bookings?availabilityId=${soAvailId}`, headers: P2.headers });
    record('SO10 estranho não lê/lista/atualiza/lista-bookings (403 ×4)',
      g2.statusCode === 403 && l2.statusCode === 403 && u2.statusCode === 403 && bl2.statusCode === 403,
      `${g2.statusCode}/${l2.statusCode}/${u2.statusCode}/${bl2.statusCode}`);
    const so2b = await createAvail(P1, P1.actorId, 'service_offering', offeringId);
    const bk2 = await app.inject({ method: 'POST', url: '/availability/bookings', headers: P2.headers, payload: { availabilityId: so2b.id, requesterActorId: P2.actorId } });
    const confirmByStranger = await app.inject({ method: 'PUT', url: `/availability/bookings/${bk2.json()?.bookingId}`, headers: P2.headers, payload: { status: 'confirmed' } });
    record('SO11 estranho (até o próprio requester) NÃO confirma booking da oferta (403)',
      confirmByStranger.statusCode === 403, `status=${confirmByStranger.statusCode}`);

    // ── negativos estruturais ────────────────────────────────────────────────
    const ghost = await createAvail(P1, P1.actorId, 'service_offering', randomUUID());
    record('NEG1 owner_id inexistente → 404 AVAILABILITY_OWNER_NOT_FOUND', ghost.status === 404 && ghost.code === 'AVAILABILITY_OWNER_NOT_FOUND', `status=${ghost.status} ${ghost.code}`);
    const mismatch = await createAvail(P1, P1.actorId, 'user', offeringId);
    record('NEG2 owner_type incompatível com owner_id (offering como user) → 404 (UUID coincidente JAMAIS autoriza)',
      mismatch.status === 404, `status=${mismatch.status} ${mismatch.code}`);
    const forged = await createAvail(P2, P1.actorId, 'service_offering', offeringId);
    record('NEG3 actionContext forjado (actor de P1, user P2) → 403 NOT_REPRESENTABLE (autoridade é server-side)',
      forged.status === 403 && forged.code === 'AVAILABILITY_WRITE_NOT_REPRESENTABLE', `status=${forged.status} ${forged.code}`);
    record('NEG4 prova material: offering.id NUNCA existe em actors',
      (await count(`SELECT count(*)::text n FROM actors WHERE id=$1::uuid`, [offeringId])) === 0);
    let checkBlocked = false;
    try {
      await pool.query(`INSERT INTO availability (tenant_id, owner_type, owner_id, start_datetime, end_datetime) VALUES ($1::uuid,'pdv',$2::uuid, NOW(), NOW() + interval '1 hour')`, [TENANT_ID, offeringId]);
    } catch (e) { checkBlocked = /chk_availability_owner_type/.test(String(e)); }
    record('NEG5 CHECK físico rejeita owner_type fora do vocabulário (pdv)', checkBlocked);

    // ═══ §13 — REGRESSÃO DOS DEMAIS OWNER TYPES VIVOS ═════════════════════════
    const matrix: Array<{ label: string; type: string; id: string }> = [
      { label: 'user', type: 'user', id: P1.actorId },
      { label: 'page', type: 'page', id: pageActorId },
      { label: 'service', type: 'service', id: serviceId },
      { label: 'event', type: 'event', id: eventId },
      { label: 'group', type: 'group', id: groupId },
    ];
    for (const m of matrix) {
      // autoridade do dono: para tipos-recurso o actionContext é o AUTHORITY ACTOR
      // (P1); para user/page o próprio actor.
      const ctxActor = m.type === 'page' ? pageActorId : P1.actorId;
      const ok = await createAvail(P1, ctxActor, m.type, m.id);
      const okRead = ok.id ? (await app.inject({ method: 'GET', url: `/availability/${ok.id}`, headers: withCtx(P1, ctxActor) })).statusCode : 0;
      const bad = await app.inject({ method: 'GET', url: `/availability/${ok.id}`, headers: P2.headers });
      record(`OT-${m.label}: dono cria (201) e lê (200); estranho 403`,
        ok.status === 201 && okRead === 200 && bad.statusCode === 403, `create=${ok.status} read=${okRead} stranger=${bad.statusCode}`);
    }
    const crossType = await createAvail(P1, P1.actorId, 'service', eventId);
    record('OT-cross: service com id de EVENT → 404 (tipo↔id fidelidade)', crossType.status === 404, `status=${crossType.status}`);

    // ═══ ZERO FINANCEIRO / ZERO CURA ══════════════════════════════════════════
    record('zero Bank writer', (await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::text n`)) === bank0);
    record('zero actor CURADO pela família temporal (contagem idêntica à pós-fixtures)',
      (await count(`SELECT count(*)::text n FROM actors WHERE tenant_id=$1::uuid`, [TENANT_ID])) === actorsAfterFixtures,
      `fixtures=${actorsAfterFixtures}`);
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
  console.log('✨ Autoridade polimórfica do owner temporal — verde.');
  process.exit(0); // CLI validator: encerra o event loop (handles transitivas)
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
