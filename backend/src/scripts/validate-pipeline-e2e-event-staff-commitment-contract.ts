/**
 * E2E — EVENT-ENGINE-COMPLETION · C2a (reconciliar event_staff ao contrato OperationalCommitment).
 * Prova que o vínculo actor-first createCommitment (que aceita banda/page/GROUP) FUNCIONA após o reconcile
 * do schema vivo ao contrato (docs/01_normative/operational_commitment_minimum_contract.md §3/§4/§5):
 * status='expected' (antes: check_violation) + lifecycle (checked_in_at/checked_out_at/failure_reason,
 * antes: coluna inexistente). event_staff é O vínculo (event_actors = paralelo PROIBIDO §2). Bank-free (Δbank=0).
 *
 *   (a) createCommitment vincula uma BANDA (actor 'group') → status='expected' (antes estourava);
 *   (b) check-in (expected→checked_in) grava checked_in_at; check-out grava checked_out_at;
 *   (c) fail grava failure_reason (status='failed');
 *   (d) transição inválida (expected→checked_out, pula check-in) → rejeitada (contrato §5);
 *   (e) autoridade DUAL na rota: (A) sem representar o contratado → 403; (B) representa mas sem
 *       manage_attendees sobre o dono → 403;
 *   (f) Δbank = 0.
 */

import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { operationalCommitmentsService } from '../core/events/operational-commitments.service';
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
  if (!/c2a|staff|commitment|ephemeral|test|e2e/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 67).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata, created_at, updated_at) VALUES ($1::uuid,$2,$3,'{}'::jsonb,NOW(),NOW())`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `c2a-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
    [tenantId, name, userId, gu]
  )).rows[0].id;
  return { userId, actorId };
}

// Banda = actor 'group' (represent-ável pelo dono do grupo). O grupo pertence a ownerActorId.
async function mkGroupBand(tenantId: string, ownerActorId: string, name: string): Promise<string> {
  seq += 1;
  const gid = (await pool.query<{ id: string }>(
    `INSERT INTO groups (tenant_id, name, slug, owner_actor_id, status, metadata) VALUES ($1::uuid,$2,$3,$4::uuid,'active','{}'::jsonb) RETURNING id::text AS id`,
    [tenantId, name, `${name}-${seq}-${Date.now()}`.toLowerCase(), ownerActorId]
  )).rows[0].id;
  // Actor não-humano (group) EXIGE responsible_actor_id humano (§4.8, trigger actor_responsibility).
  const actorId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, group_id, responsible_actor_id) VALUES ($1::uuid,'group',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
    [tenantId, name, gid, ownerActorId]
  )).rows[0].id;
  return actorId;
}

async function mkEvent(tenantId: string, ownerActorId: string): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO events (id, tenant_id, actor_id, actor_type, event_type, title, status, timezone, created_at, updated_at)
     VALUES (gen_random_uuid(),$1::uuid,$2::uuid,'user','social','Show na Praça','published','UTC',NOW(),NOW()) RETURNING id::text AS id`,
    [tenantId, ownerActorId]
  )).rows[0].id;
}

const staffCol = async (commitmentId: string, col: string): Promise<unknown> =>
  (await pool.query(`SELECT ${col} AS v FROM event_staff WHERE id=$1`, [commitmentId])).rows[0]?.v;

async function main(): Promise<void> {
  await assertEphemeralDb();

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Event Staff C2a E2E', slug: `c2a-${Date.now()}` });
  const owner = await mkUserActor(TENANT, 'Organizador');
  const eventId = await mkEvent(TENANT, owner.actorId);
  const bandOwner = await mkUserActor(TENANT, 'Empresario');       // representa as bandas (dono dos grupos)
  const band1 = await mkGroupBand(TENANT, bandOwner.actorId, 'Banda Aurora');
  const band2 = await mkGroupBand(TENANT, bandOwner.actorId, 'Banda Nevoa');
  const band3 = await mkGroupBand(TENANT, bandOwner.actorId, 'Banda Solar');

  const bankSnap = async (): Promise<string> =>
    (await pool.query<{ n: string }>(`SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`)).rows[0].n;
  const bankBefore = await bankSnap();

  console.log('\n— event_staff reconciliado ao contrato de commitment (C2a) —');

  // (a) createCommitment vincula BANDA (group) → 'expected'.
  const c1 = await operationalCommitmentsService.createCommitment(TENANT, {
    eventId, responsibleActorId: band1, responsibleActorType: 'group' as any, role: 'performer',
  } as any);
  const c1type = await staffCol(c1.id, 'responsible_actor_type');
  record('(a) createCommitment vincula BANDA (group) → status=expected (antes: check_violation)',
    c1.status === 'expected' && c1type === 'group', `status=${c1.status} type=${c1type}`);

  // (b) check-in → checked_in + checked_in_at; check-out → checked_out + checked_out_at.
  const ci = await operationalCommitmentsService.checkIn(TENANT, c1.id, {} as any);
  const ciAt = await staffCol(c1.id, 'checked_in_at');
  const co = await operationalCommitmentsService.checkOut(TENANT, c1.id, {} as any);
  const coAt = await staffCol(c1.id, 'checked_out_at');
  record('(b) check-in grava checked_in_at; check-out grava checked_out_at',
    ci.status === 'checked_in' && !!ciAt && co.status === 'checked_out' && !!coAt, `ci=${ci.status}/${!!ciAt} co=${co.status}/${!!coAt}`);

  // (c) fail grava failure_reason.
  const c2 = await operationalCommitmentsService.createCommitment(TENANT, {
    eventId, responsibleActorId: band2, responsibleActorType: 'group' as any, role: 'performer',
  } as any);
  const cf = await operationalCommitmentsService.markFailed(TENANT, c2.id, { failureReason: 'no-show' } as any);
  const frReason = await staffCol(c2.id, 'failure_reason');
  record('(c) fail grava failure_reason (status=failed)', cf.status === 'failed' && frReason === 'no-show', `status=${cf.status} reason=${frReason}`);

  // (d) transição inválida expected→checked_out (pula check-in) → rejeitada (§5).
  const c3 = await operationalCommitmentsService.createCommitment(TENANT, {
    eventId, responsibleActorId: band3, responsibleActorType: 'group' as any, role: 'performer',
  } as any);
  let transThrew = false;
  try { await operationalCommitmentsService.checkOut(TENANT, c3.id, {} as any); } catch { transThrew = true; }
  record('(d) transição inválida expected→checked_out (pula check-in) → rejeitada (§5)', transThrew, `threw=${transThrew}`);

  // (e) autoridade DUAL na ROTA (registra o core event.routes; app.inject).
  const eventRoutes = (await import('../core/events/event.routes')).default;
  const stranger = await mkUserActor(TENANT, 'Estranho');
  const mkApp = (actingUserId: string) => {
    const app = Fastify();
    app.decorateRequest('user', null);
    app.decorateRequest('tenant', null);
    app.decorateRequest('actionContext', null);
    app.addHook('onRequest', async (req: any) => {
      req.user = { userId: actingUserId, id: actingUserId };
      req.tenant = { id: TENANT };
      req.actionContext = { actorId: actingUserId, intent: 'e2e', source: 'e2e', scope: `e2e-${TENANT}` };
    });
    return app;
  };
  const body = { responsible_actor_id: band1, responsible_actor_type: 'group', role: 'performer' };

  // (A) estranho (não representa band1) → 403
  const appA = mkApp(stranger.userId); await appA.register(eventRoutes); await appA.ready();
  const rA = await appA.inject({ method: 'POST', url: `/${eventId}/v2/commitments`, headers: { 'content-type': 'application/json' }, payload: body });
  await appA.close();
  // (B) bandOwner representa band1 (dono do grupo) MAS não tem manage_attendees sobre o dono do evento → 403
  const appB = mkApp(bandOwner.userId); await appB.register(eventRoutes); await appB.ready();
  const rB = await appB.inject({ method: 'POST', url: `/${eventId}/v2/commitments`, headers: { 'content-type': 'application/json' }, payload: body });
  await appB.close();
  record('(e) autoridade DUAL: (A) sem representar contratado → 403; (B) representa mas sem manage_attendees → 403',
    rA.statusCode === 403 && rB.statusCode === 403, `A=${rA.statusCode} B=${rB.statusCode}`);

  // (f) Δbank=0.
  const bankAfter = await bankSnap();
  record('(f) Δbank=0', bankBefore === bankAfter, `${bankBefore} → ${bankAfter}`);

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
