/**
 * E2E — F-UNREAD-COUNTS-FEED-VISIBILITY-FIX (DT-UNREAD-COUNTS-FEED-VISIBILITY-PHANTOM-COLUMN).
 * NÃO MOVE DINHEIRO. Prova, via ROTAS REAIS (app.inject), que o contador `feed` de GET /feed/unread-counts
 * e GET /social/unread-counts deixou de ser `null` sempre (posts.visibility nunca existiu) e passa a
 * contar corretamente pelo predicado vivo já usado por `services` na mesma tabela: publicado + não
 * deletado + fora de grupo (fronteira não-pública materializada hoje). Escopo continua TENANT-WIDE
 * público (sem member-scoping) — o escopo já era ratificado; só o predicado quebrado foi corrigido.
 *
 *   A GET /feed/unread-counts → 200; feed = 2 (published+não-deletado+fora de grupo, dentro de 24h)
 *   B GET /social/unread-counts → 200; MESMO valor (feed=2) — consistência entre os dois endpoints
 *   C post em GRUPO não conta no feed (fronteira de grupo preservada)
 *   D post NÃO PUBLICADO não conta
 *   E post DELETADO não conta
 *   F post FORA da janela de 24h não conta
 *   G contador feed é NÚMERO (não null) — prova que a coluna fantasma parou de quebrar a query
 *   H groups/events/services continuam funcionando (contrato preservado, nada regredido)
 *   I Δbank=0 · J guard estrutural verde
 *
 * 🔒 DB EFÊMERA (run-unread-counts-feed-visibility-fix-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const cwd = process.cwd();
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/unread|counts|feed|visibility|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; gu: string }> {
  seq += 1;
  const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq * 17).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId, gu };
}
async function mkPost(tenantId: string, actorId: string, opts: { metadata?: Record<string, unknown>; published?: boolean; deleted?: boolean; createdAt?: Date }): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO posts (tenant_id, actor_id, content, metadata, is_published, is_deleted, created_at)
       VALUES ($1::uuid,$2::uuid,'E2E post',$3::jsonb,$4,$5,$6) RETURNING id::text AS id`,
    [tenantId, actorId, JSON.stringify(opts.metadata ?? {}), opts.published ?? true, opts.deleted ?? false, opts.createdAt ?? new Date()]
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
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Unread Counts Feed Visibility Fix', slug: `ucfv-${Date.now()}` });
  const alice = await mkUserActor(TENANT, 'Alice');
  const groupId = randomUUID();
  await pool.query(`INSERT INTO groups (tenant_id, name, slug, owner_actor_id, status) VALUES ($1::uuid,'GrpAlice','grp-alice',$2::uuid,'active')`, [TENANT, alice.actorId]);

  const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h atrás — fora da janela de 24h

  // 2 posts contáveis (published + não-deletado + fora de grupo, dentro de 24h)
  await mkPost(TENANT, alice.actorId, {});
  await mkPost(TENANT, alice.actorId, {});
  // 1 post em GRUPO — não deve contar no feed
  await mkPost(TENANT, alice.actorId, { metadata: { groupId } });
  // 1 post NÃO PUBLICADO — não deve contar
  await mkPost(TENANT, alice.actorId, { published: false });
  // 1 post DELETADO — não deve contar
  await mkPost(TENANT, alice.actorId, { deleted: true });
  // 1 post FORA da janela de 24h — não deve contar
  await mkPost(TENANT, alice.actorId, { createdAt: oldDate });

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const feedRoutes = (await import('../core/feed/feed.routes')).default;
  const socialRoutes = (await import('../modules/social/social.routes')).default;
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    req.user = { id: alice.userId, userId: alice.userId, globalUserId: alice.gu };
    req.tenant = { id: TENANT };
    req.actionContext = { actorId: alice.actorId, intent: 'e2e', source: 'e2e', scope: 'e2e' };
  });
  await app.register(feedRoutes, { prefix: '/feed' });
  await app.register(socialRoutes, { prefix: '/social' });
  await app.ready();

  try {
    console.log('\n— Rotas reais /feed/unread-counts + /social/unread-counts —');
    const rFeed = await app.inject({ method: 'GET', url: '/feed/unread-counts' });
    record('A GET /feed/unread-counts → 200; feed = 2 (contável dentro da janela)', rFeed.statusCode === 200, `status=${rFeed.statusCode}: ${rFeed.body.slice(0, 200)}`);
    const feedBody = rFeed.statusCode === 200 ? JSON.parse(rFeed.body) : {};
    record('A2 feed = 2 exatamente', feedBody.feed === 2, `feed=${feedBody.feed}`);

    const rSocial = await app.inject({ method: 'GET', url: '/social/unread-counts' });
    record('B GET /social/unread-counts → 200; MESMO valor (feed=2, consistência entre endpoints)', rSocial.statusCode === 200 && JSON.parse(rSocial.body).feed === 2, `status=${rSocial.statusCode} body=${rSocial.body.slice(0, 200)}`);

    console.log('\n— Fronteiras do predicado —');
    record('C post em GRUPO não conta (fronteira de grupo preservada — feed=2, não 3)', feedBody.feed === 2);
    record('D post NÃO PUBLICADO não conta (feed=2, não 3)', feedBody.feed === 2);
    record('E post DELETADO não conta (feed=2, não 3)', feedBody.feed === 2);
    record('F post FORA da janela de 24h não conta (feed=2, não 3)', feedBody.feed === 2);
    record('G contador feed é NÚMERO, não null (coluna fantasma parou de quebrar)', typeof feedBody.feed === 'number');

    record('H groups/events/services presentes no contrato (nada regredido)',
      'groups' in feedBody && 'events' in feedBody && 'services' in feedBody,
      `body=${JSON.stringify(feedBody)}`);

    const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
    record('I Δbank=0 (bank_ledger+transactions inalterados)', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

    let g = 0; try { execSync('node scripts/audit-unread-counts-feed-visibility-fix.mjs', { cwd, encoding: 'utf8' }); } catch { g = 1; }
    record('J guard estrutural verde', g === 0);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ Contador feed de /feed/unread-counts e /social/unread-counts funciona (predicado vivo, tenant-wide público); fronteiras (grupo/unpublished/deleted/janela) preservadas; Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
