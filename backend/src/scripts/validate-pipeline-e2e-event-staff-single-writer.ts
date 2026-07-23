/**
 * E2E — EVENT-ENGINE-COMPLETION · C2b (WRITER ÚNICO do vínculo actor↔evento, §2/§4.8). Prova POR API DIRETA
 * (curl-style) que o writer LEGADO user-only assignStaff está CONTIDO e NÃO executa INSERT INTO event_staff
 * paralelo; o canônico createCommitment (actor-first) segue vinculando banda (page/group) — não regrediu.
 * DB efêmera. NUNCA unificard_dev. Bank-free (Δbank=0).
 *
 *   (a) POST /events/:eventId/assign-staff (rota legada) → 501 EVENT_ASSIGN_STAFF_CONVERGED, ZERO INSERT paralelo;
 *   (b) método eventsService.assignStaff → throw EVENT_ASSIGN_STAFF_CONVERGED, ZERO INSERT (nem por chamada direta);
 *   (c) createCommitment vincula BANDA (group) → 'expected', event_staff +1 (canônico NÃO regrediu);
 *   (d) Δbank = 0.
 */

import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { operationalCommitmentsService } from '../core/events/operational-commitments.service';
import { eventsService } from '../modules/events/events.service';
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
  if (!/c2b|writer|single|staff|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 71).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata, created_at, updated_at) VALUES ($1::uuid,$2,$3,'{}'::jsonb,NOW(),NOW())`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `c2b-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
    [tenantId, name, userId, gu]
  )).rows[0].id;
  return { userId, actorId, globalUserId: gu };
}

async function mkGroupBand(tenantId: string, ownerActorId: string, name: string): Promise<string> {
  seq += 1;
  const gid = (await pool.query<{ id: string }>(
    `INSERT INTO groups (tenant_id, name, slug, owner_actor_id, status, metadata) VALUES ($1::uuid,$2,$3,$4::uuid,'active','{}'::jsonb) RETURNING id::text AS id`,
    [tenantId, name, `${name}-${seq}-${Date.now()}`.toLowerCase(), ownerActorId]
  )).rows[0].id;
  return (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, group_id, responsible_actor_id) VALUES ($1::uuid,'group',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
    [tenantId, name, gid, ownerActorId]
  )).rows[0].id;
}

async function mkEvent(tenantId: string, ownerActorId: string): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO events (id, tenant_id, actor_id, actor_type, event_type, title, status, timezone, created_at, updated_at)
     VALUES (gen_random_uuid(),$1::uuid,$2::uuid,'user','social','Show na Praça','published','UTC',NOW(),NOW()) RETURNING id::text AS id`,
    [tenantId, ownerActorId]
  )).rows[0].id;
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Event Staff Single Writer C2b', slug: `c2b-${Date.now()}` });
  const owner = await mkUserActor(TENANT, 'Organizador');
  const eventId = await mkEvent(TENANT, owner.actorId);
  const bandOwner = await mkUserActor(TENANT, 'Empresario');
  const band = await mkGroupBand(TENANT, bandOwner.actorId, 'Banda Aurora');
  const staffUser = await mkUserActor(TENANT, 'StaffLegado'); // alvo do assignStaff legado

  const countStaff = async (): Promise<number> =>
    Number((await pool.query<{ n: string }>(`SELECT COUNT(*)::int AS n FROM event_staff WHERE event_id=$1`, [eventId])).rows[0].n);
  const bankSnap = async (): Promise<string> =>
    (await pool.query<{ n: string }>(`SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`)).rows[0].n;
  const bankBefore = await bankSnap();

  console.log('\n— writer único do vínculo actor↔evento (C2b) —');

  // App com as rotas legadas de eventos (registro leve). O alvo é o 501 (primeira instrução do handler).
  const eventsRoutes = (await import('../modules/events/events.routes')).default;
  const app = Fastify();
  app.decorate('ai', { run: async () => null } as any);
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    req.user = { userId: owner.userId, id: owner.userId, globalUserId: owner.globalUserId };
    req.tenant = { id: TENANT };
    req.actionContext = { actorId: owner.actorId, intent: 'e2e', source: 'e2e', scope: `e2e-${TENANT}` };
  });
  await app.register(eventsRoutes);
  await app.ready();

  try {
    // (a) rota legada → 501 + zero INSERT paralelo.
    const c0 = await countStaff();
    const rA = await app.inject({ method: 'POST', url: `/${eventId}/assign-staff`, headers: { 'content-type': 'application/json' }, payload: { globalUserId: staffUser.globalUserId, role: 'seguranca' } });
    const bA = JSON.parse(rA.body || '{}');
    record('(a) POST /:eventId/assign-staff → 501 EVENT_ASSIGN_STAFF_CONVERGED, ZERO INSERT paralelo',
      rA.statusCode === 501 && bA?.code === 'EVENT_ASSIGN_STAFF_CONVERGED' && (await countStaff()) === c0,
      `status=${rA.statusCode} code=${bA?.code} count ${c0}→${await countStaff()}`);

    // (b) método legado direto → throw + zero INSERT (nem por chamada direta/curl-equivalente).
    const c1 = await countStaff();
    let methodCode = 'NO_THROW';
    try { await eventsService.assignStaff(TENANT, eventId, { globalUserId: staffUser.globalUserId, role: 'seguranca' } as any, owner.globalUserId); }
    catch (e: any) { methodCode = /EVENT_ASSIGN_STAFF_CONVERGED/.test(e?.message || '') ? 'EVENT_ASSIGN_STAFF_CONVERGED' : (e?.message?.slice(0, 40) || 'THROW'); }
    record('(b) método eventsService.assignStaff → throw EVENT_ASSIGN_STAFF_CONVERGED, ZERO INSERT paralelo',
      methodCode === 'EVENT_ASSIGN_STAFF_CONVERGED' && (await countStaff()) === c1, `code=${methodCode} count ${c1}→${await countStaff()}`);

    // (c) canônico createCommitment segue vinculando banda (group) → 'expected', event_staff +1.
    const c2 = await countStaff();
    const commitment = await operationalCommitmentsService.createCommitment(TENANT, {
      eventId, responsibleActorId: band, responsibleActorType: 'group' as any, role: 'performer',
    } as any);
    record('(c) createCommitment vincula BANDA (group) → expected, event_staff +1 (canônico NÃO regrediu)',
      commitment.status === 'expected' && (await countStaff()) === c2 + 1, `status=${commitment.status} count ${c2}→${await countStaff()}`);

    // (d) Δbank=0.
    record('(d) Δbank=0', bankBefore === (await bankSnap()), `${bankBefore} → ${await bankSnap()}`);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.stack ?? e?.message ?? e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
