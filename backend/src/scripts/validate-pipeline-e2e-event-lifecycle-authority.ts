/**
 * E2E — V1 FIX (auditoria forense 2026-07-04): BOLA/IDOR no lifecycle de eventos fechado.
 * Money-free; MATERIAL (autoridade). DB efêmera (runner run-event-lifecycle-authority-ephemeral.ps1).
 * NUNCA unificard_dev.
 *
 * Prova que a catraca `resolveRepresentedActor` (canRepresentActor) protege os handlers de
 * mutação de evento — antes, `getAuthenticatedUserActor` só fazia findById e o service comparava
 * `event.actorId === actorId` (ambos client-controlled) → editar/cancelar evento alheio:
 *   A · ATACANTE (autenticado, representa o PRÓPRIO actor) faz PATCH /events/:id declarando
 *       x-action-context actorId = DONO do evento → 403; título INALTERADO;
 *   B · ATACANTE tenta POST /events/:id/cancel declarando actorId = DONO → 403; status INALTERADO;
 *   C · DONO faz PATCH /events/:id como si mesmo → NÃO-403 (a catraca deixa o legítimo passar);
 *   D · Δbank=0.
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
  if (!/event|authority|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
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
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `evauth-${seq}@e2e.test`, gu]);
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

  // canRepresentActor resolve via ports-registry — sem os adapters, autoridade nega fail-closed.
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Event Lifecycle Authority E2E', slug: `evauth-${Date.now()}` });

  const owner = await mkUserActor(TENANT, 'Dono do Evento');
  const attacker = await mkUserActor(TENANT, 'Atacante');

  // Evento do DONO inserido direto (setup) — status published para permitir cancel.
  const eventId = randomUUID();
  await pool.query(
    `INSERT INTO events (id, tenant_id, actor_id, actor_type, event_type, title, status, timezone, created_at, updated_at)
     VALUES ($1::uuid,$2::uuid,$3::uuid,'user','social','Original do Dono','published','UTC',NOW(),NOW())`,
    [eventId, TENANT, owner.actorId]
  );

  // Commitment (event_staff) do evento do DONO — para F2 (markFailed) e F3 (check-in) — event_staff
  // EXISTE no schema vivo (o path economico/v2 de autorizacao/custodia/repasse e schema-ghost, por
  // isso F1 revoke fica CONTIDO por ghost hoje; o fix de F1 usa o MESMO helper provado aqui).
  const commitmentId = randomUUID();
  await pool.query(
    `INSERT INTO event_staff (id, tenant_id, event_id, responsible_actor_id, responsible_actor_type, role, status, created_at, updated_at)
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,'user','staff','active',NOW(),NOW())`,
    [commitmentId, TENANT, eventId, owner.actorId]
  );

  const eventRoutes = (await import('../core/events/event.routes')).default;
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
  await app.register(eventRoutes);
  await app.ready();

  const call = (method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, opts: { userId?: string; actorId?: string; body?: unknown } = {}) =>
    app.inject({
      method, url,
      headers: {
        ...(opts.userId ? { 'x-test-user-id': opts.userId } : {}),
        ...(opts.actorId ? { 'x-test-actor-id': opts.actorId } : {}),
        'content-type': 'application/json',
      },
      payload: opts.body as string | object | undefined,
    });

  const titleOf = async () => (await pool.query<{ title: string }>(`SELECT title FROM events WHERE id=$1`, [eventId])).rows[0]?.title;
  const statusOf = async () => (await pool.query<{ status: string }>(`SELECT status FROM events WHERE id=$1`, [eventId])).rows[0]?.status;

  try {
    console.log('\n— event lifecycle authority END-TO-END (V1 BOLA/IDOR fechado) —');
    const bankBefore = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );

    // A · ATACANTE declara actorId = DONO no PATCH → 403, título inalterado
    const rHackEdit = await call('PATCH', `/${eventId}`, {
      userId: attacker.userId,
      actorId: owner.actorId, // o atacante NÃO representa o dono
      body: { title: 'HACKED PELO ATACANTE' },
    });
    const titleAfterA = await titleOf();
    record('A PATCH com actorId do dono por ATACANTE → 403, título inalterado',
      rHackEdit.statusCode === 403 && titleAfterA === 'Original do Dono',
      `status=${rHackEdit.statusCode} title=${titleAfterA}`);

    // B · ATACANTE tenta cancelar declarando actorId = DONO → 403, status inalterado
    const rHackCancel = await call('POST', `/${eventId}/cancel`, {
      userId: attacker.userId,
      actorId: owner.actorId,
      body: { reason: 'sabotagem' },
    });
    const statusAfterB = await statusOf();
    record('B POST /cancel com actorId do dono por ATACANTE → 403, status inalterado',
      rHackCancel.statusCode === 403 && statusAfterB === 'published',
      `status=${rHackCancel.statusCode} eventStatus=${statusAfterB}`);

    // C · DONO edita o próprio evento → NÃO-403 (catraca deixa o legítimo passar)
    const rOwnerEdit = await call('PATCH', `/${eventId}`, {
      userId: owner.userId,
      actorId: owner.actorId,
      body: { title: 'Editado pelo Dono' },
    });
    record('C PATCH pelo DONO (representa a si mesmo) → NÃO-403',
      rOwnerEdit.statusCode !== 403,
      `status=${rOwnerEdit.statusCode} body=${rOwnerEdit.body?.slice(0, 160)}`);

    const staffStatus = async () => (await pool.query<{ status: string }>(`SELECT status FROM event_staff WHERE id=$1`, [commitmentId])).rows[0]?.status;

    // F2 · ATACANTE marca commitment alheio como failed → 403, status inalterado
    const rHackFail = await call('POST', `/commitments/${commitmentId}/v2/fail`, {
      userId: attacker.userId,
      actorId: attacker.actorId,
      body: { failure_reason: 'sabotagem' },
    });
    record('F2 POST /commitments/:id/fail por ATACANTE → 403, status inalterado',
      rHackFail.statusCode === 403 && (await staffStatus()) === 'active',
      `status=${rHackFail.statusCode} staff=${await staffStatus()}`);

    // F3 · ATACANTE faz check-in em commitment alheio OMITINDO observed_by (o bypass) → 403
    const rHackCheckin = await call('POST', `/commitments/${commitmentId}/v2/check-in`, {
      userId: attacker.userId,
      actorId: attacker.actorId,
      body: {}, // sem observed_by_actor_id: o bypass que a catraca antiga permitia
    });
    record('F3 POST /commitments/:id/check-in por ATACANTE (sem observed_by) → 403, status inalterado',
      rHackCheckin.statusCode === 403 && (await staffStatus()) === 'active',
      `status=${rHackCheckin.statusCode} staff=${await staffStatus()}`);

    // F3b · DONO faz check-in no próprio commitment → NÃO-403 (catraca deixa o legítimo passar)
    const rOwnerCheckin = await call('POST', `/commitments/${commitmentId}/v2/check-in`, {
      userId: owner.userId,
      actorId: owner.actorId,
      body: {},
    });
    record('F3b check-in pelo DONO → NÃO-403',
      rOwnerCheckin.statusCode !== 403,
      `status=${rOwnerCheckin.statusCode} body=${rOwnerCheckin.body?.slice(0, 160)}`);

    // D · Δbank = 0
    const bankAfter = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );
    record('D Δbank=0', bankBefore.rows[0].n === bankAfter.rows[0].n, `${bankBefore.rows[0].n} → ${bankAfter.rows[0].n}`);
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
