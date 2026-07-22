/**
 * E2E — EVENT-ENGINE-COMPLETION · A1c (WRITER ÚNICO de evento, §2/§4.8). Prova POR API DIRETA
 * (curl-style, sem frontend): as 3 rotas legadas retornam 501 EVENT_LEGACY_WRITER_CONVERGED e NÃO
 * executam INSERT INTO events paralelo (contagem antes==depois); o writer GOVERNADO (core
 * eventService.createEvent) segue criando avulso E grupo. DB efêmera. NUNCA unificard_dev. Δbank=0.
 *
 *   (a) POST /api/events/create (W2) → 501, ZERO evento novo;
 *   (b) POST /api/events/events (W3, sprint76) → 501, ZERO evento novo;
 *   (c) POST /api/events/ (W1, core) → 501, ZERO evento novo;
 *   (d) governado (service-direct) cria evento avulso E evento de grupo;
 *   (e) Δbank = 0.
 */

import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { eventService } from '../core/events/event.service';
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
  if (!/event|writer|single|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 47).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata, created_at, updated_at) VALUES ($1::uuid,$2,$3,'{}'::jsonb,NOW(),NOW())`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `evwr-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId, globalUserId: gu };
}

async function seedRealGroup(tenantId: string, ownerActorId: string, name: string): Promise<string> {
  seq += 1;
  return (
    await pool.query<{ id: string }>(
      `INSERT INTO groups (tenant_id, name, slug, owner_actor_id, status, metadata) VALUES ($1::uuid,$2,$3,$4::uuid,'active','{}'::jsonb) RETURNING id::text AS id`,
      [tenantId, name, `${name}-${seq}-${Date.now()}`.toLowerCase(), ownerActorId]
    )
  ).rows[0].id;
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Event Single Writer E2E', slug: `evwr-${Date.now()}` });
  const owner = await mkUserActor(TENANT, 'Dono');

  const countEvents = async (): Promise<number> =>
    Number((await pool.query<{ n: string }>(`SELECT COUNT(*)::int AS n FROM events WHERE tenant_id = $1`, [TENANT])).rows[0].n);

  // App só com as rotas legadas (registro leve) — o alvo é a contenção 501 (primeira instrução dos handlers).
  const eventsSprint76Routes = (await import('../modules/events/events-sprint76.routes')).default;
  const eventsRoutes = (await import('../modules/events/events.routes')).default;
  const app = Fastify();
  app.decorate('ai', { run: async () => null } as any); // stub p/ req.server.ai (só usado após o 501)
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    req.user = { userId: owner.userId, id: owner.userId, globalUserId: owner.globalUserId };
    req.tenant = { id: TENANT };
    req.actionContext = { actorId: owner.actorId, intent: 'e2e', source: 'e2e', scope: `e2e-${TENANT}` };
  });
  await app.register(eventsSprint76Routes); // W3: POST /events
  await app.register(eventsRoutes);          // W2: POST /create
  await app.ready();

  const call = (url: string, body: unknown) =>
    app.inject({ method: 'POST', url, headers: { 'content-type': 'application/json' }, payload: body as object });

  try {
    console.log('\n— event single writer (A1c) —');
    const bankBefore = (await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    )).rows[0].n;

    // (a) W2 /create → 501, zero evento
    let c0 = await countEvents();
    const rW2 = await call('/create', { title: 'X', startTime: new Date().toISOString(), endTime: new Date(Date.now() + 3600e3).toISOString() });
    const bW2 = JSON.parse(rW2.body || '{}');
    record('(a) POST /create (W2) → 501 EVENT_LEGACY_WRITER_CONVERGED, ZERO evento paralelo',
      rW2.statusCode === 501 && bW2?.code === 'EVENT_LEGACY_WRITER_CONVERGED' && (await countEvents()) === c0,
      `status=${rW2.statusCode} code=${bW2?.code} count ${c0}→${await countEvents()}`);

    // (b) W3 sprint76 /events → 501, zero evento
    c0 = await countEvents();
    const rW3 = await call('/events', { organizerActorId: owner.actorId, title: 'X', startAt: new Date().toISOString(), endAt: new Date(Date.now() + 3600e3).toISOString() });
    const bW3 = JSON.parse(rW3.body || '{}');
    record('(b) POST /events (W3 sprint76) → 501 EVENT_LEGACY_WRITER_CONVERGED, ZERO evento paralelo',
      rW3.statusCode === 501 && bW3?.code === 'EVENT_LEGACY_WRITER_CONVERGED' && (await countEvents()) === c0,
      `status=${rW3.statusCode} code=${bW3?.code} count ${c0}→${await countEvents()}`);

    // (c) W1 core '/' → 501 — registra o eventModule/core routes num app separado (mais pesado)
    c0 = await countEvents();
    let w1Status = 0; let w1Code = '';
    try {
      const eventRoutes = (await import('../core/events/event.routes')).default;
      const app2 = Fastify();
      app2.decorateRequest('user', null);
      app2.decorateRequest('tenant', null);
      app2.decorateRequest('actionContext', null);
      app2.addHook('onRequest', async (req: any) => {
        req.user = { userId: owner.userId, id: owner.userId, globalUserId: owner.globalUserId };
        req.tenant = { id: TENANT };
        req.actionContext = { actorId: owner.actorId, intent: 'e2e', source: 'e2e', scope: `e2e-${TENANT}` };
      });
      await app2.register(eventRoutes);
      await app2.ready();
      const rW1 = await app2.inject({ method: 'POST', url: '/', headers: { 'content-type': 'application/json' }, payload: { actor_id: owner.actorId, actor_type: 'user', event_type: 'community', title: 'X' } });
      w1Status = rW1.statusCode; w1Code = (JSON.parse(rW1.body || '{}')?.code) || (JSON.parse(rW1.body || '{}')?.error?.code) || rW1.body?.slice(0, 60) || '';
      await app2.close();
    } catch (e: any) { w1Code = `REGISTER_FAIL:${e?.message?.slice(0, 60)}`; }
    record('(c) POST / (W1 core) → 501 EVENT_LEGACY_WRITER_CONVERGED, ZERO evento paralelo',
      w1Status === 501 && /EVENT_LEGACY_WRITER_CONVERGED/.test(w1Code) && (await countEvents()) === c0,
      `status=${w1Status} code=${w1Code} count ${c0}→${await countEvents()}`);

    // (d) governado (service-direct): avulso + grupo
    const evAvulso = await eventService.createEvent(TENANT, { actorId: owner.actorId, actorType: 'user' as any, title: 'Governado Avulso' } as any);
    const groupId = await seedRealGroup(TENANT, owner.actorId, 'Comunidade');
    const evGrupo = await eventService.createEvent(TENANT, { actorId: owner.actorId, actorType: 'user' as any, title: 'Governado Grupo', group_id: groupId, actingUserId: owner.userId } as any);
    const ge = Number((await pool.query<{ n: string }>(`SELECT COUNT(*)::int AS n FROM group_events WHERE group_id=$1`, [groupId])).rows[0].n);
    record('(d) writer GOVERNADO cria avulso E grupo (group_events +1)', !!evAvulso.id && !!evGrupo.id && ge === 1, `avulso=${evAvulso.id} grupo=${evGrupo.id} ge=${ge}`);

    // (e) Δbank=0
    const bankAfter = (await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    )).rows[0].n;
    record('(e) Δbank=0', bankBefore === bankAfter, `${bankBefore} → ${bankAfter}`);
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
