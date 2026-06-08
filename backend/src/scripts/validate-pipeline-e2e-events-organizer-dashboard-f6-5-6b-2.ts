/**
 * E2E F6.5.6b-B2 · ORGANIZER DASHBOARD de GET /events (DECISION-0113, classe H)
 *
 * B1 fechou a discovery pública (só public+published/active). B2 abre o DASHBOARD do organizer SEM quebrar a
 * vitrine: GET /events com organizerActorId →
 *   · caller representa o organizer  → organizer_dashboard (vê os PRÓPRIOS draft/private/unlisted/group/followers);
 *   · caller NÃO representa           → public_discovery DAQUELE organizer (só public+published/active; NÃO 403);
 *   · sem organizerActorId            → public_discovery (piso B1).
 * O cliente estreita (status/visibility); o servidor define o piso. organizer_dashboard é fail-closed sem organizerActorId.
 *
 * Prova (fixtures REAIS sob o actor do dev = organizer):
 *   A decisão de modo (behavioral): canRepresentActor(dev,devActor)=true → dashboard; (estranho,devActor)=false → público.
 *   B organizer_dashboard: lista TODOS os não-públicos do PRÓPRIO organizer; estreita por status/visibility; fail-closed sem organizer.
 *   C public_discovery+organizer (caller não-representável): só public+published do organizer (vitrine preservada).
 *   D escopo: my-orders/listEvents interno intacto; B1 segue verde (regressão à parte).
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-events-organizer-dashboard-f6-5-6b-2.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const STRANGER_USER_ID = '00000000-0000-4000-8000-0000000000ee';
const MARKER = 'E2E-ORGDASH';

// fixtures sob o organizer (dev actor): 1 dentro do piso público + 5 não-públicos.
const SEEDS: Array<[string, string]> = [
  ['public', 'published'],    // visível também na vitrine pública
  ['public', 'draft'],        // só dashboard
  ['private', 'published'],   // só dashboard
  ['unlisted', 'published'],  // só dashboard
  ['group', 'published'],     // só dashboard (global B3 ainda fechado; aqui é o PRÓPRIO organizer)
  ['followers', 'published'], // só dashboard (global B4 ainda fechado; aqui é o PRÓPRIO organizer)
];

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function note(msg: string): void { console.log(`  ℹ️  ${msg}`); }
const mine = (events: Array<{ title: string }>): Array<{ title: string }> =>
  events.filter((e) => e.title && e.title.startsWith(`${MARKER}-`));

async function main(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const dev = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM users WHERE email=$1 AND tenant_id=$2 LIMIT 1`, [DEV_EMAIL, TENANT_ID]);
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devUserId = dev.rows[0].id;
  const actor = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM actors WHERE tenant_id=$1 AND user_id=$2::uuid AND actor_type='user' LIMIT 1`,
    [TENANT_ID, devUserId]);
  const devActor = actor.rows[0]?.id;
  if (!devActor) { console.error('❌ user-actor do dev não encontrado.'); process.exit(1); }

  await pool.query(`DELETE FROM events WHERE tenant_id=$1 AND title LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
  for (const [vis, st] of SEEDS) {
    await pool.query(
      `INSERT INTO events (id, tenant_id, actor_id, actor_type, event_type, title, status, visibility)
       VALUES (gen_random_uuid(), $1, $2, 'user', 'social', $3, $4, $5)`,
      [TENANT_ID, devActor, `${MARKER}-${vis}-${st}`, st, vis]);
  }

  try {
    const { authorizationService } = await import('../core/authorization/authorization.service');
    const { eventRepository } = await import('../modules/events/event.repository');

    console.log('\n— A decisão de modo (behavioral REAL): quem representa o organizer entra no dashboard —');
    record('A1 dev representa o próprio actor → true (rota escolhe organizer_dashboard)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
    record('A2 estranho NÃO representa o actor do dev → false (rota cai em public_discovery, NÃO 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);

    console.log('\n— B organizer_dashboard: o organizer vê os PRÓPRIOS não-públicos —');
    const dash = mine(await eventRepository.listEvents(TENANT_ID, { visibilityMode: 'organizer_dashboard', organizerActorId: devActor, limit: 100000 }) as any);
    note(`dashboard: ${dash.map((e) => e.title.replace(MARKER + '-', '')).sort().join(', ')}`);
    record('B1 dashboard devolve os 6 do organizer (public/draft/private/unlisted/group/followers)', dash.length === 6, `n=${dash.length}`);
    record('B2 dashboard inclui draft+private+unlisted+group+followers do PRÓPRIO organizer',
      ['public-draft', 'private-published', 'unlisted-published', 'group-published', 'followers-published'].every((t) => dash.some((e) => e.title.endsWith(t))));
    const dashDraft = mine(await eventRepository.listEvents(TENANT_ID, { visibilityMode: 'organizer_dashboard', organizerActorId: devActor, status: 'DRAFT' as any, limit: 100000 }) as any);
    record('B3 dashboard + status=DRAFT → só o draft do organizer (cliente estreita)',
      dashDraft.length === 1 && dashDraft[0].title.endsWith('public-draft'), `n=${dashDraft.length}`);
    const dashPriv = mine(await eventRepository.listEvents(TENANT_ID, { visibilityMode: 'organizer_dashboard', organizerActorId: devActor, visibility: 'private', limit: 100000 }) as any);
    record('B4 dashboard + visibility=private → só o private do organizer (cliente estreita)',
      dashPriv.length === 1 && dashPriv[0].title.endsWith('private-published'), `n=${dashPriv.length}`);
    const dashNoOrg = mine(await eventRepository.listEvents(TENANT_ID, { visibilityMode: 'organizer_dashboard', limit: 100000 }) as any);
    record('B5 organizer_dashboard SEM organizerActorId → vazio (fail-closed; não vira "ver tudo")',
      dashNoOrg.length === 0, `n=${dashNoOrg.length}`);

    console.log('\n— C public_discovery + organizer (caller NÃO-representável): só a vitrine pública do organizer —');
    const pub = mine(await eventRepository.listEvents(TENANT_ID, { visibilityMode: 'public_discovery', organizerActorId: devActor, limit: 100000 }) as any);
    record('C1 não-representável vê SÓ public+published do organizer (1 fixture), não os não-públicos',
      pub.length === 1 && pub[0].title.endsWith('public-published'), `titles=${pub.map((e) => e.title).join('|')}`);
  } finally {
    await pool.query(`DELETE FROM events WHERE tenant_id=$1 AND title LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
  }

  console.log('\n— D estrutural: rota decide por canRepresentActor; repo fail-closed; my-orders intacto —');
  const repo = readFileSync(join(process.cwd(), 'src/modules/events/event.repository.ts'), 'utf8');
  const route = readFileSync(join(process.cwd(), 'src/modules/events/events-sprint76.routes.ts'), 'utf8');
  const myOrders = readFileSync(join(process.cwd(), 'src/modules/my-orders/my-orders.service.ts'), 'utf8');
  record('D1 rota: canRepresentActor(tenantId, userId, organizerActorId) → sobe p/ organizer_dashboard',
    /canRepresentActor\(tenantId, userId, req\.query\.organizerActorId\)/.test(route) && /filters\.visibilityMode = 'organizer_dashboard'/.test(route));
  record('D2 rota: NÃO dá 403 ao não-representável (cai em public_discovery — default do filtro)',
    /visibilityMode: 'public_discovery'/.test(route) && !/return reply\.status\(403\)/.test(route));
  record('D3 repo: organizer_dashboard é fail-closed sem organizerActorId (1 = 0)',
    /filters\.visibilityMode === 'organizer_dashboard'/.test(repo) && /if \(!filters\.organizerActorId\)/.test(repo));
  record('D4 my-orders.service NÃO passa visibilityMode (caller interno preservado)',
    /listEvents\(tenantId, \{ limit: 10000 \}\)/.test(myOrders) && !/visibilityMode/.test(myOrders));

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
  console.log('✨ Organizer dashboard (representável vê próprios não-públicos; não-representável só vitrine; fail-closed) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
