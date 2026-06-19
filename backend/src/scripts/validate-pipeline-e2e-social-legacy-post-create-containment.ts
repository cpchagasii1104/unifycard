/**
 * E2E — F-AUTHORITY-Z2-R8A-SOCIAL-LEGACY-POST-CREATE-BIND-OR-CONTAIN (DECISION-0113 / DECISION-0131 §B7 / Z2).
 * NÃO MOVE DINHEIRO. Prova a CONTENÇÃO fail-closed da rota LEGADA POST /social/posts/create.
 *
 * A rota legada (social.routes.ts) era ungated-authority (req.actionContext.actorId direto como autor em
 * socialService.createPost, sem canRepresentActor) E dead-at-db (INSERT em colunas-fantasma). Zero caller vivo
 * (frontend usa a canônica POST /social/posts; orchestrator usa /marketplace/posts/create; nenhum teste a chama).
 * DECISÃO: CONTER (501 nomeado), NÃO religar.
 *
 *   A POST legado (com actionContext) → 501 SOCIAL_LEGACY_POST_CREATE_CONTAINED
 *   B POST legado (sem actionContext) → 501 (contenção incondicional, antes de qualquer gate/sink)
 *   C posts count inalterado (zero write — dead-at-db nunca persistiu; agora nem é chamado)
 *   D canônica POST /social/posts (self-actor) → INTACTA (≠501, ≠404, code ≠ SOCIAL_POST_ACTOR_NOT_REPRESENTABLE)
 *   E guard R8A verde · F guard R6.2 (canônica) verde · G baseline canal-1 verde
 *
 * 🔒 DB EFÊMERA (run-social-legacy-post-create-containment-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const cwd = process.cwd();

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/social|posts|legacy|contain|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1;
  const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq * 13).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version, is_test, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3::uuid,$4,'x',0,true,NOW(),NOW())`, [userId, tenantId, gu, `${name}-${seq}@e2e.test`]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId, globalUserId: gu };
}

const postsCount = async (tenantId: string): Promise<number> =>
  (await pool.query<{ c: number }>(`SELECT count(*)::int AS c FROM posts WHERE tenant_id=$1`, [tenantId])).rows[0].c;

async function main(): Promise<void> {
  await assertEphemeralDb();

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const tenantId = (await pool.query<{ id: string }>(`INSERT INTO tenants (name, slug) VALUES ('Social Legacy Containment E2E', $1) RETURNING id::text AS id`, [`social-legacy-e2e-${Date.now()}`])).rows[0].id;
  await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [tenantId]);
  const alice = await mkUserActor(tenantId, 'alice');

  const Fastify = (await import('fastify')).default;
  const { default: socialRoutes } = await import('../modules/social/social.routes');
  const { default: social2Routes } = await import('../modules/social/social-2.0.routes');
  const app = Fastify();
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    const uid = req.headers['x-test-user-id'];
    const aid = req.headers['x-test-actor-id'];
    r.tenant = { id: tenantId };
    r.user = uid ? { userId: String(uid), id: String(uid), tenantId, globalUserId: String(req.headers['x-test-gu'] || '') } : null;
    r.actionContext = aid ? { actorId: String(aid) } : undefined;
  });
  await app.register(socialRoutes, { prefix: '/social' });   // legado (rota contida)
  await app.register(social2Routes, { prefix: '/social' });  // canônica (viva)
  await app.ready();

  const hdr = (u: { userId: string; globalUserId: string; actorId: string }): Record<string, string> => ({ 'x-test-user-id': u.userId, 'x-test-gu': u.globalUserId, 'x-test-actor-id': u.actorId, 'content-type': 'application/json' });
  const isContained = (r: { statusCode: number; body: string }): boolean => {
    if (r.statusCode !== 501) return false;
    try { return JSON.parse(r.body)?.code === 'SOCIAL_LEGACY_POST_CREATE_CONTAINED'; } catch { return false; }
  };

  try {
    const before = await postsCount(tenantId);

    console.log('\n— Rota legada CONTIDA —');
    const a = await app.inject({ method: 'POST', url: '/social/posts/create', headers: hdr(alice), payload: JSON.stringify({ content: 'legacy post via actionContext' }) });
    record('A POST legado (com actionContext) → 501 SOCIAL_LEGACY_POST_CREATE_CONTAINED', isContained(a), `status=${a.statusCode}: ${a.body.slice(0,140)}`);

    const b = await app.inject({ method: 'POST', url: '/social/posts/create', headers: { 'x-test-user-id': alice.userId, 'content-type': 'application/json' }, payload: JSON.stringify({ content: 'legacy post sem actionContext' }) });
    record('B POST legado (sem actionContext) → 501 (contenção incondicional, antes de gate/sink)', isContained(b), `status=${b.statusCode}: ${b.body.slice(0,140)}`);

    console.log('\n— Zero write —');
    record('C posts count inalterado (rota contida não escreve)', (await postsCount(tenantId)) === before, `before=${before} after=${await postsCount(tenantId)}`);

    console.log('\n— Canônica POST /social/posts INTACTA —');
    const d = await app.inject({ method: 'POST', url: '/social/posts', headers: hdr(alice), payload: JSON.stringify({ content: 'canonical post', actor_id: alice.actorId }) });
    let dCode: string | undefined; try { dCode = JSON.parse(d.body)?.code; } catch { /* noop */ }
    record('D canônica POST /social/posts (self-actor) INTACTA (≠501, ≠404, code ≠ SOCIAL_POST_ACTOR_NOT_REPRESENTABLE)',
      d.statusCode !== 501 && d.statusCode !== 404 && dCode !== 'SOCIAL_POST_ACTOR_NOT_REPRESENTABLE', `status=${d.statusCode} code=${dCode}`);

    console.log('\n— Guards —');
    let gR8a = 0; try { execSync('node scripts/audit-social-legacy-post-create-containment.mjs', { cwd, encoding: 'utf8' }); } catch { gR8a = 1; }
    record('E guard R8A containment verde', gR8a === 0);
    let gR62 = 0; try { execSync('node scripts/audit-social-posts-actor-binding.mjs', { cwd, encoding: 'utf8' }); } catch { gR62 = 1; }
    record('F guard R6.2 social-posts (canônica) verde', gR62 === 0);
    let gBaseline = 0; try { execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' }); } catch { gBaseline = 1; }
    record('G baseline canal-1 verde (social.routes mantido)', gBaseline === 0);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ POST /social/posts/create CONTIDO fail-closed (501); zero write; canônica POST /social/posts intacta; guards verdes.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
