/**
 * E2E — F-CORE-FEED-BATCH-GETPOSTSBATCH-COLUMN-FIX (DT-CORE-FEED-BATCH-POST-ID-SCHEMA-MISMATCH).
 * NÃO MOVE DINHEIRO. Prova, via ROTA REAL (app.inject, não chamada direta ao service), que
 * `POST /feed/plugin/render-batch` deixou de quebrar por coluna inexistente (`posts.post_id`) e volta
 * a renderizar/declarar ações para TODOS os plugins de feed — não só o de serviços. `getPostsBatch`
 * (core, compartilhado) agora usa `id AS post_id` / `WHERE id = ANY($1)` (posts PK real).
 *
 * Opção 2 (achado colateral, decisão soberana Clayton): `renderBatch` também resolvia `post.intent`
 * com cast cru (`as ActorIntent`), nunca batendo com o enum comparado em `canHandle` dos plugins
 * (posts gravam a string legada, ex.: 'service_offer') — NENHUM plugin resolvia via batch, mesmo sem
 * o bug de coluna. Corrigido com `LEGACY_INTENT_MAP` (mesma fonte do `ActorIntent` já importado).
 *
 *   A POST /render-batch com posts reais (serviço canônico) → 200 ok=true
 *   B post com serviceId → dto renderizado (id bate); actions inclui VIEW; BOOK CONTIDO (A2c, drift 0156)
 *   C post sem serviceId → dto null, actions []
 *   D postId inexistente no batch (uuid válido, sem linha) → entrada com dto null, actions [] (sem 500)
 *   E múltiplos posts no mesmo batch → cada um resolvido independentemente (sem cross-contamination)
 *   F Δbank=0 · G guard dedicado verde · H guard getPost singular (irmão já fechado) não regride
 *
 * 🔒 DB EFÊMERA (run-core-feed-batch-post-id-column-fix-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { feedPluginService } from '../core/feed/feed-plugin.service';
import { servicesFeedPlugin } from '../modules/services/service-feed.plugin';
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
  if (!/feed|batch|core|column|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
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
async function mkService(tenantId: string, ownerActorId: string, name: string, canonicalServiceId: string): Promise<string> {
  seq += 1;
  return (await pool.query<{ id: string }>(`INSERT INTO services (tenant_id, actor_id, name, slug, canonical_service_id, service_type, status, currency) VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,'service','active','BRL') RETURNING service_id::text AS id`, [tenantId, ownerActorId, name, `${name.toLowerCase()}-${seq}`, canonicalServiceId])).rows[0].id;
}
async function mkPost(tenantId: string, actorId: string, metadata: Record<string, unknown>): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO posts (tenant_id, actor_id, content, intent, metadata) VALUES ($1::uuid,$2::uuid,'E2E post','service_offer',$3::jsonb) RETURNING id::text AS id`,
    [tenantId, actorId, JSON.stringify(metadata)]
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
  feedPluginService.registerPlugin(servicesFeedPlugin); // mesmo registro de services.module.ts

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Core Feed Batch PostId Column Fix', slug: `cfbp-${Date.now()}` });
  const canonicalServiceId = (await pool.query<{ id: string }>(`SELECT id::text AS id FROM canonical_services LIMIT 1`)).rows[0]?.id;
  if (!canonicalServiceId) throw new Error('Sem canonical_services no banco efêmero.');

  const alice = await mkUserActor(TENANT, 'Alice');
  const serviceId = await mkService(TENANT, alice.actorId, 'SvcAlice', canonicalServiceId);
  const postWithService = await mkPost(TENANT, alice.actorId, { service_id: serviceId });
  const postWithoutService = await mkPost(TENANT, alice.actorId, {});
  const missingPostId = randomUUID(); // UUID válido, sem linha em posts

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const feedPluginRoutes = (await import('../core/feed/feed-plugin.routes')).default;
  const app = Fastify();
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    req.tenant = { id: TENANT };
    req.actionContext = { actorId: alice.actorId, intent: 'e2e', source: 'e2e', scope: 'e2e' };
  });
  await app.register(feedPluginRoutes, { prefix: '/plugin' });
  await app.ready();

  const renderBatch = (postIds: string[]) => app.inject({
    method: 'POST', url: '/plugin/render-batch',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ postIds }),
  });

  try {
    console.log('\n— POST /feed/plugin/render-batch (rota real) —');
    const r = await renderBatch([postWithService, postWithoutService, missingPostId]);
    record('A POST /render-batch com posts reais → 200 ok=true', r.statusCode === 200, `status=${r.statusCode}: ${r.body.slice(0, 200)}`);
    const body = r.statusCode === 200 ? JSON.parse(r.body) : {};
    const data = body?.data ?? {};

    const entryWithService = data[postWithService];
    const actionsWithService: string[] = entryWithService?.actions ?? [];
    record('B post com serviceId → dto renderizado (id bate); VIEW presente; BOOK ausente (A2c/drift 0156)',
      entryWithService?.dto?.id === postWithService && actionsWithService.includes('view') && !actionsWithService.includes('book'),
      `entry=${JSON.stringify(entryWithService)}`);

    const entryNoService = data[postWithoutService];
    record('C post sem serviceId → dto null, actions []', entryNoService?.dto === null && (entryNoService?.actions ?? []).length === 0, `entry=${JSON.stringify(entryNoService)}`);

    const entryMissing = data[missingPostId];
    record('D postId inexistente → entrada com dto null, actions [] (sem 500/crash)', !!entryMissing && entryMissing.dto === null && entryMissing.actions.length === 0, `entry=${JSON.stringify(entryMissing)}`);

    record('E múltiplos posts resolvidos independentemente (sem cross-contamination)',
      entryWithService?.dto?.id === postWithService && entryNoService?.dto === null,
      `withService=${entryWithService?.dto?.id} withoutService=${entryNoService?.dto}`);

    const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
    record('F Δbank=0 (bank_ledger+transactions inalterados)', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

    let g1 = 0; try { execSync('node scripts/audit-core-feed-batch-post-id-column-fix.mjs', { cwd, encoding: 'utf8' }); } catch { g1 = 1; }
    record('G guard dedicado verde (getPostsBatch usa id AS post_id / WHERE id=ANY)', g1 === 0);
    let g2 = 0; try { execSync('node scripts/audit-service-feed-getpost-column-fix.mjs', { cwd, encoding: 'utf8' }); } catch { g2 = 1; }
    record('H guard getPost singular (irmão já fechado) não regride', g2 === 0);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ POST /feed/plugin/render-batch revivido para TODOS os plugins de feed (id AS post_id); BOOK segue contido pelo A2c; drift 0156 não reaberto; Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
