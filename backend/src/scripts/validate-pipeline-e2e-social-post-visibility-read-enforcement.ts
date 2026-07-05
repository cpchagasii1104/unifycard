/**
 * E2E — F-SOCIAL-POST-VISIBILITY-READ-ENFORCEMENT (Fatia 5, fecha DT-SOCIAL-POST-VISIBILITY-
 * NOT-ENFORCED-ON-READ). Money-free; MATERIAL (coluna posts.visibility nova + enforcement em 3
 * pontos de leitura + fix de autoridade em GET /feed). Roda SÓ em DB efêmera
 * (runner run-social-post-visibility-ephemeral.ps1). NUNCA unificard_dev.
 *
 * Prova o coração da fatia — "a plateia declarada na escrita é OBEDECIDA na leitura":
 *   A · Autor cria 3 posts (public/connections/only_me);
 *   B · GET /social/actors/:id como ESTRANHO → só o post 'public' aparece (posts + counts);
 *   C · GET /social/actors/:id como o PRÓPRIO autor → os 3 aparecem (dono sempre vê tudo);
 *   D · aresta actor_relationships ACEITA entre autor e um 3º actor → esse actor vê 'public' +
 *       'connections' (NÃO 'only_me');
 *   E · GET /social/feed como estranho → feed NÃO contém 'connections'/'only_me' do autor;
 *   F · GET /social/feed como o actor conectado → feed CONTÉM 'connections' do autor;
 *   G · 🔴 achado do read-first, fechado nesta fatia: um ATACANTE tenta ler o feed passando
 *       ?actor_id=<actor conectado> (impersonação via querystring) para herdar a visão
 *       'connections' sem realmente representar esse actor → canRepresentActor nega, o
 *       atacante cai no PRÓPRIO actor (sem relação) e NÃO vê o post 'connections';
 *   H · visibility fora do vocabulário governado → 400, zero post criado;
 *   I · Δbank=0.
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
  if (!/visibility|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; gu: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 23).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `spv-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId, gu };
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
  await tenantService.createTenant({ id: TENANT, name: 'SocialPostVisibility Tenant', slug: `spv-${Date.now()}` });

  const author = await mkUserActor(TENANT, 'Autor Plateia E2E');
  const stranger = await mkUserActor(TENANT, 'Estranho E2E');
  const connected = await mkUserActor(TENANT, 'Conectado E2E');
  const attacker = await mkUserActor(TENANT, 'Atacante E2E');

  const social2Routes = (await import('../modules/social/social-2.0.routes')).default;
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    const uid = req.headers['x-test-user-id'];
    const gu = req.headers['x-test-global-user-id'];
    const aid = req.headers['x-test-actor-id'];
    const tid = req.headers['x-test-tenant-id'];
    req.user = uid ? { userId: uid, id: uid, globalUserId: gu } : null;
    req.tenant = tid ? { id: tid } : null;
    req.actionContext = aid ? { actorId: aid, intent: 'e2e', source: 'e2e', scope: 'e2e' } : null;
  });
  await app.register(social2Routes, { prefix: '/social' });
  await app.ready();

  const call = (method: 'GET' | 'POST', url: string, opts: { userId?: string; gu?: string; actorId?: string; body?: unknown } = {}) =>
    app.inject({
      method,
      url,
      headers: {
        ...(opts.userId ? { 'x-test-user-id': opts.userId } : {}),
        ...(opts.gu ? { 'x-test-global-user-id': opts.gu } : {}),
        ...(opts.actorId ? { 'x-test-actor-id': opts.actorId } : {}),
        'x-test-tenant-id': TENANT,
        'content-type': 'application/json',
      },
      payload: opts.body as string | object | undefined,
    });

  try {
    console.log('\n— social post visibility read-enforcement END-TO-END (a plateia é obedecida na leitura) —');

    const bankBefore = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );

    // A · autor cria os 3 posts
    const mk = async (visibility: string) => {
      const r = await call('POST', '/social/posts', {
        userId: author.userId, gu: author.gu, actorId: author.actorId,
        body: { content: `post ${visibility}`, actor_id: author.actorId, intent: 'personal', visibility },
      });
      return r;
    };
    const rPublic = await mk('public');
    const rConnections = await mk('connections');
    const rOnlyMe = await mk('only_me');
    record('A autor cria 3 posts (public/connections/only_me) → 201 cada',
      rPublic.statusCode === 201 && rConnections.statusCode === 201 && rOnlyMe.statusCode === 201,
      `public=${rPublic.statusCode} connections=${rConnections.statusCode} only_me=${rOnlyMe.statusCode}`);

    // B · estranho vê só o público
    const rB = await call('GET', `/social/actors/${author.actorId}`, { userId: stranger.userId, gu: stranger.gu, actorId: stranger.actorId });
    const bBody = rB.json() as any;
    const bContents = (bBody?.posts ?? []).map((p: any) => p.content);
    record('B estranho vê SÓ o post public (posts + counts.posts_count=1)',
      rB.statusCode === 200 && bContents.length === 1 && bContents[0] === 'post public' && bBody?.counts?.posts_count === 1,
      `posts=${JSON.stringify(bContents)} count=${bBody?.counts?.posts_count}`);

    // C · o próprio autor vê os 3
    const rC = await call('GET', `/social/actors/${author.actorId}`, { userId: author.userId, gu: author.gu, actorId: author.actorId });
    const cBody = rC.json() as any;
    record('C o próprio autor vê os 3 posts (dono sempre vê tudo)',
      rC.statusCode === 200 && (cBody?.posts ?? []).length === 3 && cBody?.counts?.posts_count === 3,
      `n=${(cBody?.posts ?? []).length} count=${cBody?.counts?.posts_count}`);

    // D · aresta accepted entre autor e "conectado" → vê public+connections, não only_me
    await pool.query(
      `INSERT INTO actor_relationships (tenant_id, from_actor_id, to_actor_id, status, requester_label, target_label, created_by_user_id, responded_by_user_id)
       VALUES ($1::uuid,$2::uuid,$3::uuid,'accepted','amigo','amigo',$4::uuid,$5::uuid)`,
      [TENANT, author.actorId, connected.actorId, author.userId, connected.userId]
    );
    const rD = await call('GET', `/social/actors/${author.actorId}`, { userId: connected.userId, gu: connected.gu, actorId: connected.actorId });
    const dBody = rD.json() as any;
    const dContents = (dBody?.posts ?? []).map((p: any) => p.content).sort();
    record("D conectado (aresta accepted) vê public+connections, NÃO only_me",
      rD.statusCode === 200 && JSON.stringify(dContents) === JSON.stringify(['post connections', 'post public']) &&
      dBody?.counts?.posts_count === 2,
      `posts=${JSON.stringify(dContents)} count=${dBody?.counts?.posts_count}`);

    // E · feed do estranho não contém connections/only_me do autor
    const rE = await call('GET', '/social/feed?actor_type=user', { userId: stranger.userId, gu: stranger.gu, actorId: stranger.actorId });
    const eContents = ((rE.json() as any)?.posts ?? []).map((p: any) => p.content);
    record('E feed do estranho: só o public do autor aparece',
      rE.statusCode === 200 && eContents.includes('post public') &&
      !eContents.includes('post connections') && !eContents.includes('post only_me'),
      `feed=${JSON.stringify(eContents)}`);

    // F · feed do conectado contém connections
    const rF = await call('GET', '/social/feed?actor_type=user', { userId: connected.userId, gu: connected.gu, actorId: connected.actorId });
    const fContents = ((rF.json() as any)?.posts ?? []).map((p: any) => p.content);
    record('F feed do conectado: public+connections aparecem, only_me não',
      rF.statusCode === 200 && fContents.includes('post public') && fContents.includes('post connections') &&
      !fContents.includes('post only_me'),
      `feed=${JSON.stringify(fContents)}`);

    // G · 🔴 atacante tenta herdar a visão do "conectado" via ?actor_id= no feed
    const rG = await call('GET', `/social/feed?actor_type=user&actor_id=${connected.actorId}`, { userId: attacker.userId, gu: attacker.gu, actorId: attacker.actorId });
    const gContents = ((rG.json() as any)?.posts ?? []).map((p: any) => p.content);
    record("G atacante NÃO herda a plateia do conectado via ?actor_id= (canRepresentActor nega, cai no próprio actor)",
      rG.statusCode === 200 && !gContents.includes('post connections'),
      `feed=${JSON.stringify(gContents)}`);

    // H · visibility fora do vocabulário → 400, zero post com valor inválido
    const beforeCount = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM posts`);
    const rH = await call('POST', '/social/posts', {
      userId: author.userId, gu: author.gu, actorId: author.actorId,
      body: { content: 'post invalido', actor_id: author.actorId, intent: 'personal', visibility: 'FRIENDS_ONLY_HACK' },
    });
    const afterCount = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM posts`);
    record('H visibility fora do vocabulário → 400, zero post novo',
      rH.statusCode === 400 && beforeCount.rows[0].n === afterCount.rows[0].n,
      `status=${rH.statusCode} count ${beforeCount.rows[0].n}→${afterCount.rows[0].n}`);

    // I · Δbank = 0
    const bankAfter = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );
    record('I Δbank=0 (nenhuma tabela de valor tocada)', bankBefore.rows[0].n === bankAfter.rows[0].n,
      `${bankBefore.rows[0].n} → ${bankAfter.rows[0].n}`);
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
