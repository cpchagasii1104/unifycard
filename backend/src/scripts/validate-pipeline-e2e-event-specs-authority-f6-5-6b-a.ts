/**
 * E2E F6.5.6b-A · EVENT-SPECS por actor_id (DECISION-0113, canal 3 — A privado actor-keyed)
 *
 * EventSpec é planning/intention PRIVADO do actor (macro_intention/answers/metadata). GET /event-specs?actor_id
 * lia specs de QUALQUER actor declarado na query, sem validar (protectedScope autentica, mas o actor_id era
 * cru) → leak cross-user do planejamento alheio. Fix (A): quando query.actor_id presente, prova
 * canRepresentActor(user_id, actor_id) ANTES de queryEventSpecs; 401 sem user / 403 não-leak. O caminho por
 * event_id (sem actor_id) NÃO é tocado (depende do modelo de visibility — F6.5.6b-B/canal 5). EventSpec ≠ bank.
 *
 * Prova:
 *   A behavioral REAL — canRepresentActor nega cross-user (dev próprio=true / estranho=false).
 *   B estrutural — gate (canRepresentActor sobre actor_id) ANTES de queryEventSpecs, só if(actorIdFilter); 401/403.
 *   C escopo — caminho event_id preservado (gate só dentro do if actor_id); GET /events e listEvents intocados.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-event-specs-authority-f6-5-6b-a.ts
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

  console.log('\n— A behavioral REAL: o gate (canRepresentActor) nega cross-user no planning do actor —');
  record('A1 dev representa o próprio actor → true (specs do próprio passam)',
    (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
  record('A2 estranho NÃO representa o actor do dev → false (specs alheios → 403)',
    (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);

  console.log('\n— B estrutural: gate sobre o actor_id filtrado ANTES de queryEventSpecs (só if actor_id) —');
  const src = readFileSync(join(process.cwd(), 'src/modules/events/events-spec.routes.ts'), 'utf8');
  // isolar o handler GET /event-specs (lista) do GET /event-specs/:specId e dos writes
  const getListIdx = src.indexOf("}>('/event-specs', async (request, reply) => {", src.indexOf("Querystring"));
  const block = getListIdx >= 0 ? src.slice(getListIdx, getListIdx + 2400) : '';
  record('B1 GET /event-specs: canRepresentActor(tenantId, userId, actorIdFilter) ANTES de queryEventSpecs(',
    gateBeforeRead(block, 'canRepresentActor(tenantId, userId, actorIdFilter)', 'queryEventSpecs('));
  record('B2 gate dentro de if(actorIdFilter) (não gateia o caminho event_id)',
    /if \(actorIdFilter\) \{/.test(block) && block.indexOf('if (actorIdFilter)') < block.indexOf('canRepresentActor('));
  record('B3 403 não-leak quando não representável + 401 sem user',
    /Actor não representável pelo usuário autenticado/.test(block) && /Unauthorized/.test(block));

  console.log('\n— C escopo: caminho event_id preservado; gate de event-specs é INDEPENDENTE do discovery —');
  record('C1 caminho event_id segue no queryEventSpecs (eventId: request.query.event_id preservado)',
    /eventId: request\.query\.event_id/.test(block));
  // NOTA: o discovery (GET /events) evoluiu DEPOIS desta fatia (F6.5.6b-B1/B2). A canRepresentActor que existe
  // hoje no sprint76 é para decidir o organizer_dashboard (B2), NÃO para gatear event-specs — concerns separados.
  const sprint76 = readFileSync(join(process.cwd(), 'src/modules/events/events-sprint76.routes.ts'), 'utf8');
  record('C2 a canRepresentActor do discovery (sprint76) é só p/ organizer_dashboard (B2), não gateia event-specs',
    /filters\.visibilityMode = 'organizer_dashboard'/.test(sprint76));
  record('C3 o gate de event-specs vive no PRÓPRIO arquivo (events-spec.routes.ts), independente do discovery',
    /canRepresentActor\(tenantId, userId, actorIdFilter\)/.test(src) && !/visibilityMode/.test(src));

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
  console.log('✨ Event-specs?actor_id gateado (canRepresentActor; caminho event_id e /events intocados) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
