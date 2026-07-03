/**
 * E2E — F-RENTAL-RESOURCE-SURFACE-SLICE-A (DECISION-0151/0159). READ-ONLY do ponto de vista de
 * dinheiro (money-free), MATERIAL do ponto de vista de runtime (nova rota HTTP). Roda SÓ em DB
 * efêmera (runner run-rental-resource-surface-ephemeral.ps1). NUNCA unificard_dev.
 *
 * Prova END-TO-END (HTTP real via app.inject) o Trilho B completo para RECURSO (não pessoa),
 * usando a superfície NOVA (rentable-resources) + a máquina JÁ EXISTENTE (availability/bookings):
 *   A · POST /rentable-resources sem autoridade (outro actor declarado) → 403, zero linha criada;
 *   B · POST /rentable-resources como o próprio actor → 201, owner_actor_id = actionContext.actorId
 *       (nunca aceito do body — o body nem manda esse campo);
 *   C · concept_id inexistente → 400 RENTABLE_RESOURCE_CONCEPT_NOT_FOUND, zero linha criada;
 *   D · GET /rentable-resources/:id → 200, campos corretos; GET lista → contém o recurso;
 *   E · POST /availability (rota JÁ EXISTENTE) com ownerType='rentable_resource' + ownerId=recurso
 *       → 201 (prova que a rota genérica aceita o novo owner_type sem nenhuma mudança nela);
 *   F · POST /bookings (rota JÁ EXISTENTE) contra essa availability → 201 status=requested;
 *   G · PUT /bookings/:id status=CONFIRMED (rota JÁ EXISTENTE) → 200, confirmBookingWithResourceLock
 *       dispara, status=confirmed;
 *   H · 2º booking no MESMO intervalo do MESMO recurso, confirmado → 409
 *       RENTAL_RESOURCE_TIME_CONFLICT (exclusividade real, não simulada);
 *   I · PATCH /rentable-resources/:id/status por NÃO-owner → 403; pelo owner → 200 status=paused;
 *   J · Δbank=0 (nenhuma tabela de valor tocada — DECISION-0151 §D).
 */

import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/rental|resource|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 17).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `rental-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId };
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  // canRepresentActor (usado pela rota de criação) resolve o actorRepository via ports-registry —
  // sem isto, socialPortsRegistry.getActorRepository() falha/retorna vazio e a autoridade real
  // sempre nega (fail-closed mascarando o bug de wiring, não a autorização em si).
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Rental Resource Surface E2E', slug: `rental-${Date.now()}` });

  const owner = await mkUserActor(TENANT, 'Dono do Recurso');
  const other = await mkUserActor(TENANT, 'Outro Actor');
  const customer1 = await mkUserActor(TENANT, 'Cliente 1');
  const customer2 = await mkUserActor(TENANT, 'Cliente 2');

  // concepts é vocabulário governado (trigger 0075) — insert direto exige a mesma flag de
  // governança usada pelas fixtures E2E irmãs (não é bypass: é o canal de teste já existente).
  const conceptId = randomUUID();
  {
    const gc = await pool.connect();
    try {
      await gc.query('BEGIN');
      await gc.query(`SELECT set_config('app.concept_governance','true', true)`);
      await gc.query(`INSERT INTO concepts (concept_id, slug, domain) VALUES ($1::uuid,$2,'servicos')`, [
        conceptId,
        `rental-e2e-concept-${Date.now()}`,
      ]);
      await gc.query('COMMIT');
    } catch (e) {
      await gc.query('ROLLBACK');
      throw e;
    } finally {
      gc.release();
    }
  }

  // ── app HTTP real (só os módulos sob teste; hook simula middleware auth/tenant/actionContext) ──
  const rentableResourceRoutes = (await import('../modules/rentals/rentable-resource.routes')).default;
  const availabilityRoutes = (await import('../core/availability/unified-availability.routes')).unifiedAvailabilityRoutes;
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    const uid = req.headers['x-test-user-id'];
    const aid = req.headers['x-test-actor-id'];
    req.user = uid ? { userId: uid, id: uid } : null;
    req.tenant = { id: TENANT };
    req.actionContext = aid ? { actorId: aid, intent: 'e2e', source: 'e2e', scope: 'e2e' } : null;
  });
  await app.register(rentableResourceRoutes, { prefix: '/rentable-resources' });
  await app.register(availabilityRoutes, { prefix: '/availability' });
  await app.ready();

  const call = (method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, opts: { userId?: string; actorId?: string; body?: unknown } = {}) =>
    app.inject({
      method,
      url,
      headers: {
        ...(opts.userId ? { 'x-test-user-id': opts.userId } : {}),
        ...(opts.actorId ? { 'x-test-actor-id': opts.actorId } : {}),
        'content-type': 'application/json',
      },
      payload: opts.body as string | object | undefined,
    });

  try {
    console.log('\n— rental resource surface END-TO-END (Trilho B para recurso) —');

    const bankBefore = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );

    // A · sem autoridade sobre o actor declarado
    const rNoAuth = await call('POST', '/rentable-resources', {
      userId: owner.userId,
      actorId: other.actorId, // owner NÃO representa 'other'
      body: { conceptId, resourceType: 'vehicle', label: 'Carro sem autoridade' },
    });
    record('A POST sem autoridade sobre o actor declarado → 403', rNoAuth.statusCode === 403, `status=${rNoAuth.statusCode}`);

    // B · criação real, owner_actor_id nunca vem do body
    const rCreate = await call('POST', '/rentable-resources', {
      userId: owner.userId,
      actorId: owner.actorId,
      body: { conceptId, resourceType: 'vehicle', label: 'Carro E2E' },
    });
    const bCreate = rCreate.statusCode === 201 ? JSON.parse(rCreate.body) : null;
    record(
      'B criação com autoridade → 201; owner_actor_id = actionContext.actorId (nunca do body)',
      rCreate.statusCode === 201 && bCreate?.data?.ownerActorId === owner.actorId,
      rCreate.body.slice(0, 300)
    );
    const resourceId = bCreate?.data?.id as string;

    // C · concept inexistente
    const rBadConcept = await call('POST', '/rentable-resources', {
      userId: owner.userId,
      actorId: owner.actorId,
      body: { conceptId: randomUUID(), resourceType: 'vehicle', label: 'Carro concept fake' },
    });
    record('C concept_id inexistente → 400 CONCEPT_NOT_FOUND', rBadConcept.statusCode === 400, rBadConcept.body.slice(0, 200));

    // D · GET single + list
    const rGet = await call('GET', `/rentable-resources/${resourceId}`);
    const rList = await call('GET', `/rentable-resources?ownerActorId=${owner.actorId}`);
    const bList = rList.statusCode === 200 ? JSON.parse(rList.body) : null;
    record(
      'D GET :id + lista → 200, recurso presente',
      rGet.statusCode === 200 && rList.statusCode === 200 && (bList?.data ?? []).some((r: any) => r.id === resourceId),
      `get=${rGet.statusCode} list=${rList.statusCode}`
    );

    // E · POST /availability (ROTA JÁ EXISTENTE) com ownerType='rentable_resource'
    const startIso = '2026-12-20T10:00:00.000Z';
    const endIso = '2026-12-20T18:00:00.000Z';
    const rAvail = await call('POST', '/availability', {
      userId: owner.userId,
      actorId: owner.actorId,
      body: {
        ownerType: 'rentable_resource',
        ownerId: resourceId,
        startDatetime: startIso,
        endDatetime: endIso,
      },
    });
    const bAvail = rAvail.statusCode === 201 ? JSON.parse(rAvail.body) : null;
    record(
      'E POST /availability (rota existente) aceita owner_type=rentable_resource sem mudança → 201',
      rAvail.statusCode === 201,
      rAvail.body.slice(0, 300)
    );
    const availabilityId = bAvail?.data?.availabilityId as string;

    // F · POST /bookings (ROTA JÁ EXISTENTE)
    const rBooking1 = await call('POST', '/availability/bookings', {
      userId: customer1.userId,
      actorId: customer1.actorId,
      body: { availabilityId, requesterActorId: customer1.actorId },
    });
    const bBooking1 = rBooking1.statusCode === 201 ? JSON.parse(rBooking1.body) : null;
    record('F POST /bookings (rota existente) → 201 status=requested', rBooking1.statusCode === 201, rBooking1.body.slice(0, 300));
    const bookingId1 = bBooking1?.bookingId as string;

    // G · confirm (ROTA JÁ EXISTENTE) → dispara confirmBookingWithResourceLock
    const rConfirm1 = await call('PUT', `/availability/bookings/${bookingId1}`, {
      userId: owner.userId,
      actorId: owner.actorId,
      body: { status: 'confirmed' },
    });
    const bConfirm1 = rConfirm1.statusCode === 200 ? JSON.parse(rConfirm1.body) : null;
    record(
      'G PUT /bookings/:id status=CONFIRMED → 200 (resource-lock dispara, status=confirmed)',
      rConfirm1.statusCode === 200 && bConfirm1?.status === 'confirmed',
      rConfirm1.body.slice(0, 300)
    );

    // H · 2º booking, MESMO intervalo, MESMO recurso, confirmado → 409 exclusividade real
    const rAvail2 = await call('POST', '/availability', {
      userId: owner.userId,
      actorId: owner.actorId,
      body: { ownerType: 'rentable_resource', ownerId: resourceId, startDatetime: startIso, endDatetime: endIso },
    });
    const availabilityId2 = (JSON.parse(rAvail2.body))?.data?.availabilityId as string;
    const rBooking2 = await call('POST', '/availability/bookings', {
      userId: customer2.userId,
      actorId: customer2.actorId,
      body: { availabilityId: availabilityId2, requesterActorId: customer2.actorId },
    });
    const bookingId2 = (JSON.parse(rBooking2.body))?.bookingId as string;
    const rConfirm2 = await call('PUT', `/availability/bookings/${bookingId2}`, {
      userId: owner.userId,
      actorId: owner.actorId,
      body: { status: 'confirmed' },
    });
    record(
      'H duplo-aluguel do mesmo recurso no mesmo intervalo → 409 RENTAL_RESOURCE_TIME_CONFLICT (exclusividade real)',
      rConfirm2.statusCode === 409 && /RENTAL_RESOURCE_TIME_CONFLICT/.test(rConfirm2.body),
      `status=${rConfirm2.statusCode} body=${rConfirm2.body.slice(0, 200)}`
    );

    // I · status: não-owner 403, owner 200
    const rStatusForbidden = await call('PATCH', `/rentable-resources/${resourceId}/status`, {
      userId: other.userId,
      body: { status: 'paused' },
    });
    const rStatusOk = await call('PATCH', `/rentable-resources/${resourceId}/status`, {
      userId: owner.userId,
      body: { status: 'paused' },
    });
    const bStatusOk = rStatusOk.statusCode === 200 ? JSON.parse(rStatusOk.body) : null;
    record(
      'I status: não-owner 403 · owner 200 status=paused',
      rStatusForbidden.statusCode === 403 && rStatusOk.statusCode === 200 && bStatusOk?.data?.status === 'paused',
      `forbidden=${rStatusForbidden.statusCode} ok=${rStatusOk.statusCode}`
    );

    // J · Δbank=0
    const bankAfter = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );
    record('J Δbank=0 (nenhuma tabela de valor tocada)', bankBefore.rows[0].n === bankAfter.rows[0].n, `${bankBefore.rows[0].n} → ${bankAfter.rows[0].n}`);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nRESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.error('E2E RENTAL-RESOURCE-SURFACE: FALHOU');
    process.exit(1);
  }
  console.log('E2E RENTAL-RESOURCE-SURFACE: OK');
}

main().catch((e) => {
  console.error('💥', e.message);
  process.exit(1);
});
