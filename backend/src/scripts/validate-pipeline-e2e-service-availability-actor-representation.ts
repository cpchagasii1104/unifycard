/**
 * E2E — AUDIT-004 C1/C2 (contenção de personificação viva): POST/PUT /services/:serviceId/availability
 * repassavam req.actionContext.actorId (client-declared) CRU ao writer, com o sink fazendo só
 * igualdade `service.actorId === callerActorId` — NÃO prova de representação. Vetor: atacante declara
 * actorId do DONO da vítima → igualdade passa → escreve na agenda alheia. FIX: a rota resolve o serviço
 * server-side e prova canRepresentActor(req.user.userId, current.actorId) ANTES de escrever, sob
 * current.actorId (dono real), descartando o hint. Money-free; MATERIAL. DB efêmera. NUNCA unificard_dev.
 *
 *   (a) NEGATIVA — atacante declara actorId do DONO → 403 SERVICE_ACTOR_NOT_REPRESENTABLE; ZERO escrita
 *       (POST não cria; PUT não altera a janela da vítima);
 *   (b) POSITIVA — dono cria/edita a PRÓPRIA agenda → 201/200, janela materializada (owner_type='service');
 *   (c) DELEGAÇÃO — user que REPRESENTA o dono por delegação FULL (scopes '*') → 201 (multi-actor legítimo);
 *   (d) Δbank = 0.
 */

import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { servicesService } from '../modules/services/services.service';
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
  if (!/service|svc|availability|avail|authority|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 37).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata, created_at, updated_at) VALUES ($1::uuid,$2,$3,'{}'::jsonb,NOW(),NOW())`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `svcavail-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId, globalUserId: gu };
}

async function seedService(tenantId: string, ownerActorId: string, name: string): Promise<string> {
  seq += 1;
  // canonical_service_id é NOT NULL + FK; as migrations FULL já materializam catálogo global — referencia um.
  const canon = (await pool.query<{ id: string }>(`SELECT id::text AS id FROM canonical_services WHERE scope='global' LIMIT 1`)).rows[0];
  if (!canon) throw new Error('nenhum canonical_services global no schema (migrations FULL não aplicadas?)');
  const row = (
    await pool.query<{ id: string }>(
      `INSERT INTO services (tenant_id, actor_id, name, slug, service_type, status, canonical_service_id)
       VALUES ($1::uuid,$2::uuid,$3,$4,'service','active',$5::uuid) RETURNING service_id::text AS id`,
      [tenantId, ownerActorId, name, `svc-avail-${seq}-${Date.now()}`, canon.id]
    )
  ).rows[0];
  return row.id;
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  // ports-registry (canRepresentActor resolve o actor via socialPortsRegistry.getActorRepository()).
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Service Availability Actor Representation E2E', slug: `svcavail-${Date.now()}` });

  const owner = await mkUserActor(TENANT, 'Dono do Servico');
  const attacker = await mkUserActor(TENANT, 'Atacante');
  const delegate = await mkUserActor(TENANT, 'Delegado do Dono');

  // serviço da vítima (owner)
  const serviceId = await seedService(TENANT, owner.actorId, 'Corte da Vitima');

  // delegação FULL: delegate.userActor → institutional=owner.actorId, scopes ['*'] (representação ampla).
  await pool.query(
    `INSERT INTO actor_delegations (tenant_id, user_actor_id, institutional_actor_id, scopes_json, status)
     VALUES ($1::uuid,$2::uuid,$3::uuid,'["*"]'::jsonb,'active')`,
    [TENANT, delegate.actorId, owner.actorId]
  );

  const servicesRoutes = (await import('../modules/services/services.routes')).default;
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    const uid = req.headers['x-test-user-id'];
    const aid = req.headers['x-test-actor-id'];
    req.user = uid ? { userId: uid, id: uid } : null;
    req.tenant = { id: TENANT };
    req.actionContext = aid ? { actorId: aid, intent: 'e2e', source: 'e2e', scope: `e2e-${TENANT}` } : null;
  });
  await app.register(servicesRoutes);
  await app.ready();

  const call = (method: 'POST' | 'PUT', url: string, opts: { userId?: string; actorId?: string; body?: unknown }) =>
    app.inject({
      method, url,
      headers: {
        ...(opts.userId ? { 'x-test-user-id': opts.userId } : {}),
        ...(opts.actorId ? { 'x-test-actor-id': opts.actorId } : {}),
        'content-type': 'application/json',
      },
      payload: opts.body as object,
    });

  const listCount = async (): Promise<number> => (await servicesService.listServiceAvailabilities(TENANT, serviceId)).length;

  const W = (d: string) => ({ startDatetime: `2026-08-${d}T09:00:00Z`, endDatetime: `2026-08-${d}T12:00:00Z`, timezone: 'America/Sao_Paulo' });

  try {
    console.log('\n— service availability · actor representation (AUDIT-004 C1/C2) —');
    const bankBefore = (await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    )).rows[0].n;

    // (b) POSITIVA — dono cria a própria agenda → 201; janela materializada
    const c0 = await listCount();
    const rOwner = await call('POST', `/${serviceId}/availability`, { userId: owner.userId, actorId: owner.actorId, body: W('01') });
    const ownerBody = JSON.parse(rOwner.body || '{}');
    const avId = ownerBody?.data?.id;
    record('(b) POST dono → 201 + janela criada (owner_type=service)',
      rOwner.statusCode === 201 && !!avId && (await listCount()) === c0 + 1,
      `status=${rOwner.statusCode} id=${avId}`);

    // (a) NEGATIVA POST — atacante declara actorId do DONO → 403; NENHUMA janela nova
    const cBeforeHack = await listCount();
    const rHack = await call('POST', `/${serviceId}/availability`, { userId: attacker.userId, actorId: owner.actorId, body: W('05') });
    const hackBody = JSON.parse(rHack.body || '{}');
    const cAfterHack = await listCount();
    record('(a) POST atacante declarando actorId do DONO → 403 SERVICE_ACTOR_NOT_REPRESENTABLE, ZERO escrita',
      rHack.statusCode === 403 && hackBody?.code === 'SERVICE_ACTOR_NOT_REPRESENTABLE' && cAfterHack === cBeforeHack,
      `status=${rHack.statusCode} code=${hackBody?.code} count ${cBeforeHack}→${cAfterHack}`);

    // (a) NEGATIVA PUT — atacante tenta editar a janela do DONO → 403; janela INALTERADA
    const beforePut = (await servicesService.listServiceAvailabilities(TENANT, serviceId)).find((x) => x.availabilityId === avId);
    const rHackPut = await call('PUT', `/${serviceId}/availability/${avId}`, { userId: attacker.userId, actorId: owner.actorId, body: { status: 'paused' } });
    const afterPut = (await servicesService.listServiceAvailabilities(TENANT, serviceId)).find((x) => x.availabilityId === avId);
    const hackPutBody = JSON.parse(rHackPut.body || '{}');
    record('(a) PUT atacante na janela do DONO → 403; status da janela INALTERADO',
      rHackPut.statusCode === 403 && hackPutBody?.code === 'SERVICE_ACTOR_NOT_REPRESENTABLE' && !!afterPut && afterPut.status === beforePut?.status,
      `status=${rHackPut.statusCode} code=${hackPutBody?.code} janela ${beforePut?.status}→${afterPut?.status}`);

    // (b) POSITIVA PUT — dono edita a própria janela → 200
    const rOwnerPut = await call('PUT', `/${serviceId}/availability/${avId}`, { userId: owner.userId, actorId: owner.actorId, body: { status: 'paused' } });
    const ownerPutAfter = (await servicesService.listServiceAvailabilities(TENANT, serviceId)).find((x) => x.availabilityId === avId);
    record('(b) PUT dono edita a própria janela → 200 + status refletido',
      rOwnerPut.statusCode === 200 && ownerPutAfter?.status === 'paused',
      `status=${rOwnerPut.statusCode} janela=${ownerPutAfter?.status}`);

    // (c) DELEGAÇÃO — delegado com representação FULL do dono → 201 (multi-actor legítimo preservado)
    const cBeforeDeleg = await listCount();
    const rDeleg = await call('POST', `/${serviceId}/availability`, { userId: delegate.userId, actorId: owner.actorId, body: W('02') });
    record('(c) POST delegado (representa o dono, delegação FULL) → 201 + janela criada',
      rDeleg.statusCode === 201 && (await listCount()) === cBeforeDeleg + 1,
      `status=${rDeleg.statusCode}`);

    // (d) Δbank = 0
    const bankAfter = (await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    )).rows[0].n;
    record('(d) Δbank=0', bankBefore === bankAfter, `${bankBefore} → ${bankAfter}`);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.message ?? e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
