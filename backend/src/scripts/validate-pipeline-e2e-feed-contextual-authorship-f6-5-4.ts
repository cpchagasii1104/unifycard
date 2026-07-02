/**
 * E2E F6.5.4 — feed/contextual (DECISION-0113, resíduo de leituras operacionais)
 *
 * Antes: GET /feed/contextual lia feed PERSONALIZADO (estado inferido do actor) usando `actionContext.actorId`
 *   sem gate → spoofar o actorId lê o feed pessoal de outro actor.
 * Fix (CRA): canRepresentActor(req.user.userId, actionContext.actorId) ANTES de getContextualFeed; 401 sem
 *   req.user; 400 sem actionContext; 403 não-leak. Não altera ranking/algoritmo/semântica do feed.
 *
 * Prova (com BEHAVIORAL REAL — cobrança explícita de Clayton; as 2 fatias anteriores foram N/A por DEV magro):
 *   A behavioral primitivo — canRepresentActor nega cross-user (a decisão do gate).
 *   B behavioral REAL — feedService.getContextualFeed(tenant, devActor, limit) é CHAMADO de verdade e
 *     retorna a estrutura FeedContextual (userState + sections[]) — prova que a "sala" abre p/ actor legítimo
 *     (o feed vem do estado inferido do actor, não de posts → independe de posts=0 em DEV).
 *   C estrutural — gate canRepresentActor ANTES de getContextualFeed; 401/400/403 fail-closed.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-feed-contextual-authorship-f6-5-4.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const STRANGER_USER_ID = '00000000-0000-4000-8000-0000000000ee';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function gateBeforeRead(src: string, gateMarker: string, readMarker: string): boolean {
  const g = src.indexOf(gateMarker);
  const r = src.indexOf(readMarker);
  return g >= 0 && r >= 0 && g < r;
}

async function main(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const dev = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1`,
    [DEV_EMAIL, TENANT_ID]
  );
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devUserId = dev.rows[0].id;
  const devActorRow = await pool.query<{ actor_id: string }>(
    `SELECT actor_id FROM actors WHERE tenant_id=$1 AND user_id=$2::uuid AND actor_type='user' LIMIT 1`,
    [TENANT_ID, devUserId]
  );
  const devActor = devActorRow.rows[0]?.actor_id;
  if (!devActor) { console.error('❌ user-actor do dev não encontrado.'); process.exit(1); }

  const { authorizationService } = await import('../core/authorization/authorization.service');

  console.log('\n— A behavioral: o gate (canRepresentActor) nega cross-user —');
  record('A1 dev representa o próprio actor → true (gate libera)',
    (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
  record('A2 estranho NÃO representa o actor do dev → false (gate bloqueia → 403)',
    (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);

  console.log('\n— B behavioral REAL: getContextualFeed é chamado de verdade p/ o actor legítimo —');
  const { feedService } = await import('../core/feed/feed.service');
  let feed: any = null;
  let feedErr: string | null = null;
  try {
    feed = await feedService.getContextualFeed(TENANT_ID, devActor, 20);
  } catch (e) {
    feedErr = (e as Error).message;
  }
  record('B1 getContextualFeed(devActor) retorna estrutura FeedContextual (sala ABRE p/ actor legítimo)',
    !!feed && typeof feed.userState !== 'undefined' && Array.isArray(feed.sections),
    feedErr ? `lançou: ${feedErr}` : `feed=${feed ? 'ok' : 'null'}`);
  // A "negação" do cross-user acontece no gate da ROTA (antes de chamar o service); o service em si não gateia.
  // Behavioralmente: o gate (A2) decide 403 para o estranho ANTES desta chamada — provado por A2 + C.
  record('B2 o feed é PERSONALIZADO (vem do estado inferido do actor, não público): tem userState + sections',
    !!feed && 'userState' in feed && 'sections' in feed && 'contextHeader' in feed);

  console.log('\n— C estrutural: gate ANTES de getContextualFeed + fail-closed —');
  const src = readFileSync(join(process.cwd(), 'src/core/feed/feed.routes.ts'), 'utf8');
  record('C1 gate canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId) ANTES de getContextualFeed(',
    gateBeforeRead(src, 'canReadFeed = await authorizationService.canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId)', 'getContextualFeed('));
  record('C2 401 sem req.user + 400 sem actionContext + 403 fail-closed não representável',
    /if \(!req\.user\)/.test(src) && /if \(!req\.actionContext\?\.actorId\)/.test(src) && /if \(!canReadFeed\)/.test(src) && /status\(403\)/.test(src));
  record('C3 não altera ranking/algoritmo: a chamada a getContextualFeed permanece (tenant, actionContext.actorId, limit)',
    /getContextualFeed\(\s*req\.tenant\.id,\s*req\.actionContext\.actorId,\s*limit/.test(src));
  // 🔴 F-UNREAD-COUNTS-FEED-VISIBILITY-FIX: âncora original (`visibility = 'PUBLIC'`) era o predicado
  // QUEBRADO do contador feed (posts.visibility nunca existiu — DT-UNREAD-COUNTS-FEED-VISIBILITY-
  // PHANTOM-COLUMN, corrigido). C4 nunca testou a semântica do predicado — testava que o handler
  // /unread-counts NÃO foi gateado por F6.5.4 (fora de escopo daquela fatia). Âncora trocada para a
  // identidade estável do bloco (countOrNull('feed' + rota unread-counts), sem depender do predicado.
  const unreadCountsHandler = src.slice(src.indexOf(`'/unread-counts'`));
  record("C4 /feed/unread-counts (contador 'feed', tenant-wide público) NÃO foi gateado (fora de escopo)",
    /unread-counts/.test(src) && /countOrNull\(\s*\n?\s*'feed'/.test(unreadCountsHandler) && !/canRepresentActor/.test(unreadCountsHandler));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Feed contextual authorship F6.5.4 (canRepresentActor antes do feed pessoal; behavioral real) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
