/**
 * E2E — F-FOLLOW-ACTIVATION-SLICE-A (decisão soberana Clayton 2026-07-06: "seguir EXISTE").
 * 🔒 Roda SÓ em DB efêmera (run-follow-activation-ephemeral.ps1). NUNCA unificard_dev.
 *
 * Prova o caminho VIVO do follow (substrato 20260530310000 + hardening 20260706150000):
 *   A · POST /social/actors/:id/follow → 200, is_following=true, linha em `follows` (follower derivado
 *       SERVER-SIDE da identidade — não do body);
 *   B · idempotente (2º follow não duplica — UNIQUE uq_follows);
 *   C · unfollow → is_following=false, linha removida;
 *   D · CHECK not-self morde (INSERT direto A→A rejeitado);
 *   E · RLS ENABLE+FORCE vivo na tabela `follows`.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'node:crypto';
import { pool } from '../core/database/pool';


const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const rec = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeral(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: alvo é unificard_dev.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function mkUserActor(T: string, nome: string): Promise<{ userId: string; actorId: string; email: string }> {
  const gu = randomUUID(); const uid = randomUUID();
  const tax = String(Date.now() + Math.floor(Math.random() * 100000)).slice(-11);
  const email = `${nome}-${Date.now()}-${Math.floor(Math.random() * 1e5)}@e2e.test`;
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1,$1,$2,$3,'x',0,true,$4,NOW(),NOW())`, [uid, T, email, gu]);
  const a = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1,'user',$2,$3,$4) RETURNING id`, [T, nome, uid, gu])).rows[0].id;
  await pool.query(`UPDATE actors SET actor_id = id WHERE id = $1`, [a]);
  return { userId: uid, actorId: a, email };
}

async function main(): Promise<void> {
  await assertEphemeral();
  const T = (await pool.query<{ id: string }>(`INSERT INTO tenants (name, slug) VALUES ('T Follow','t-follow-${Date.now()}') RETURNING id`)).rows[0].id;
  const alice = await mkUserActor(T, 'Alice');
  const bob = await mkUserActor(T, 'Bob');

  // App mínimo com sessão injetada (padrão do E2E R2): registra SÓ as rotas sob teste.
  // DI do social (a rota usa ensureUserActor → socialPortsRegistry; sem isto = 500).
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
  const gu = (await pool.query<{ global_user_id: string }>(`SELECT global_user_id FROM users WHERE id=$1`, [alice.userId])).rows[0].global_user_id;
  const Fastify = (await import('fastify')).default;
  const app = Fastify({ logger: false });
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    r.tenant = { id: T };
    r.user = { id: alice.userId, userId: alice.userId, globalUserId: gu };
    r.actionContext = { actorId: alice.actorId };
  });
  const social2Routes = (await import('../modules/social/social-2.0.routes')).default;
  await app.register(social2Routes, { prefix: '/social' });
  await app.ready();
  const H = { 'x-acting-actor': alice.actorId };

  // A · follow
  const rA = await app.inject({ method: 'POST', url: `/social/actors/${bob.actorId}/follow`, headers: H });
  const bodyA = rA.statusCode === 200 ? JSON.parse(rA.body) : null;
  const rowA = (await pool.query<{ f: string }>(`SELECT follower_actor_id AS f FROM follows WHERE tenant_id=$1 AND followed_actor_id=$2`, [T, bob.actorId])).rows[0];
  rec('A follow → 200 is_following=true + linha com follower derivado server-side (= actor da Alice)',
    rA.statusCode === 200 && bodyA?.is_following === true && rowA?.f === alice.actorId,
    `status=${rA.statusCode} follower=${rowA?.f}`);

  // B · idempotente
  const rB = await app.inject({ method: 'POST', url: `/social/actors/${bob.actorId}/follow`, headers: H });
  const nB = Number((await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM follows WHERE tenant_id=$1 AND followed_actor_id=$2 AND follower_actor_id=$3`, [T, bob.actorId, alice.actorId])).rows[0].n);
  rec('B 2º follow idempotente (200, sem duplicar)', rB.statusCode === 200 && nB === 1, `status=${rB.statusCode} linhas=${nB}`);

  // C · unfollow
  const rC = await app.inject({ method: 'POST', url: `/social/actors/${bob.actorId}/unfollow`, headers: H });
  const nC = Number((await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM follows WHERE tenant_id=$1 AND followed_actor_id=$2 AND follower_actor_id=$3`, [T, bob.actorId, alice.actorId])).rows[0].n);
  rec('C unfollow → is_following=false + linha removida', rC.statusCode === 200 && JSON.parse(rC.body)?.is_following === false && nC === 0, `status=${rC.statusCode} linhas=${nC}`);
  await app.close();

  // D · not-self (INSERT direto)
  let selfRej = false;
  try { await pool.query(`INSERT INTO follows (tenant_id, follower_actor_id, followed_actor_id) VALUES ($1,$2,$2)`, [T, alice.actorId]); }
  catch (e: any) { selfRej = /chk_follows_not_self/i.test(e.message); }
  rec('D CHECK not-self morde (A→A rejeitado)', selfRej);

  // E · RLS
  const rls = (await pool.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
    `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='follows'`)).rows[0];
  rec('E RLS ENABLE+FORCE em follows', !!rls?.relrowsecurity && !!rls?.relforcerowsecurity, JSON.stringify(rls));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error('💥 fatal:', e?.message ?? e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
