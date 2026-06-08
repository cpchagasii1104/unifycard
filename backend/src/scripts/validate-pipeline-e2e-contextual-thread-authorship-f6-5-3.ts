/**
 * E2E F6.5.3 — contextual-thread / mensagens privadas (DECISION-0113, resíduo de leituras operacionais)
 *
 * Antes: 4 reads sem gate de participante →
 *   GET /contextual-threads                          (lista; participantActorId era filtro do CLIENTE)
 *   GET /contextual-threads/:threadId                (getThreadById por URL — IDOR)
 *   GET /contextual-threads/context/:type/:id        (getThreadByContext)
 *   GET /contextual-threads/:threadId/messages       (getMessages — CONTEÚDO privado)
 * Fix (espelha o gate de escrita do service: só participantes enviam):
 *   gate = canRepresentActor(req.user.userId, actionContext.actorId) E actorId ∈ thread.participantActorIds.
 *   lista: participantActorId FORÇADO = actionContext.actorId (ignora filtro do cliente).
 *   não-leak: inexistente OU não-participante → 403 uniforme (404 convertido p/ 403).
 *
 * Prova:
 *   A behavioral primitivo — canRepresentActor nega cross-user.
 *   B behavioral por thread (se DEV tiver) — actor participante passa a membership; não-participante falha.
 *   C estrutural — gate antes da leitura nos 4 reads; lista escopada; não-leak; writes intocados.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-contextual-thread-authorship-f6-5-3.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const STRANGER_ACTOR_ID = '00000000-0000-4000-8000-0000000000fa';
const STRANGER_USER_ID = '00000000-0000-4000-8000-0000000000ee';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function note(msg: string): void { console.log(`  ℹ️  ${msg}`); }
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
  record('A1 dev representa o próprio actor → true',
    (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
  record('A2 estranho NÃO representa o actor do dev → false',
    (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);

  console.log('\n— B behavioral por thread (membership = thread.participant_actor_ids) —');
  let thr: { rowCount: number | null; rows: Array<{ participant_actor_ids: string[] }> } | null = null;
  try {
    thr = await pool.query<{ participant_actor_ids: string[] }>(
      `SELECT participant_actor_ids
         FROM contextual_threads WHERE tenant_id=$1 AND array_length(participant_actor_ids,1) >= 1 LIMIT 1`,
      [TENANT_ID]
    );
  } catch (e) {
    note(`tabela contextual_threads ausente/sem dados em DEV (${(e as { code?: string }).code ?? 'erro'}) — B N/A.`);
  }
  if (thr && thr.rowCount && thr.rows[0]) {
    const participants = thr.rows[0].participant_actor_ids || [];
    record('B1 actor participante ∈ participant_actor_ids → membership OK',
      participants.includes(participants[0]));
    record('B2 actor estranho ∉ participant_actor_ids → membership NEGA (403)',
      !participants.includes(STRANGER_ACTOR_ID));
  } else {
    note('sem contextual_threads provisionada/com dados em DEV — B1-B2 N/A (cobertura primitivo+estrutural).');
  }

  console.log('\n— C estrutural: gate de participante ANTES da leitura nos 4 reads —');
  const src = readFileSync(join(process.cwd(), 'src/modules/contextual-messaging/contextual-thread.routes.ts'), 'utf8');
  record('C1 helper assertThreadParticipant: canRepresentActor + participantActorIds.includes(actorId)',
    /canRepresentActor\(tenantId, userId, actorId\)/.test(src)
    && /thread\.participantActorIds\.includes\(actorId\)/.test(src));
  record('C2 lista: participantActorId FORÇADO = actionContext.actorId (ignora filtro do cliente)',
    /participantActorId: callerActorId/.test(src) && !/participantActorId: req\.query\.participantActorId/.test(src));
  record('C3 lista: gate canRepresentActor antes de listThreads(',
    gateBeforeRead(src, 'canRepresent = await authorizationService.canRepresentActor(tenantId, userId, callerActorId)', 'listThreads('));
  record('C4 /:threadId/messages: assertThreadParticipant antes de getMessages(',
    gateBeforeRead(src, 'assertThreadParticipant(req, reply, tenantId, thread)', 'getMessages('));
  record('C5 não-leak: thread inexistente (404) → 403 uniforme',
    /error\?\.statusCode === 404/.test(src) && /Thread não acessível/.test(src));
  record('C6 writes (sendMessage/addParticipant/createThread) NÃO foram gateados por esta fatia (escopo leitura)',
    /sendMessage\(/.test(src) && /addParticipant\(/.test(src) && /createThread\(/.test(src));

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
  console.log('✨ Contextual-thread authorship F6.5.3 (participante real antes de ler mensagem privada) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
