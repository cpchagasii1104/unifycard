/**
 * E2E F6.5.6b-CANAL5-C · search herda piso B1–B4 + compare herda canViewEvent (DECISION-0113, canal 5)
 *
 * GET /events/search era 2ª listagem SEM piso (vazava private/draft/group/followers/unlisted). Agora searchEvents
 * herda a régua de discovery: status published/active + visibility public OU group(membro) OU followers(follow),
 * via discoveryUserId server-side. POST /events/compare recebia eventIds[] sem checar visibility → agora a rota
 * roda canViewEvent por eventId ANTES de comparar; se QUALQUER id invisível → 404 não-leak (sem parcial).
 *
 * Prova (fixtures REAIS): organizer O (page; dev segue) + grupo dono=O (dev membro simples) + eventos.
 *   SEARCH behavioral: searchEvents(discoveryUserId) respeita o piso; filtros regionais preservados.
 *   COMPARE: a régua da rota (canViewEvent por id, 404 se algum invisível) provada via o predicado + estrutura.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-events-search-compare-visibility-f6-5-6b-c5c.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const STRANGER_USER_ID = '00000000-0000-4000-8000-0000000000ee';
const MARKER = 'E2E-C5C';
const CITY_X = '11111111-1111-4111-8111-111111111111';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function note(msg: string): void { console.log(`  ℹ️  ${msg}`); }
const mineTitles = (events: Array<{ title: string }>): string[] =>
  events.filter((e) => e.title && e.title.startsWith(`${MARKER}-`)).map((e) => e.title.replace(`${MARKER}-`, '')).sort();

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
  const devActorRow = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM actors WHERE tenant_id=$1 AND user_id=$2::uuid AND actor_type='user' LIMIT 1`,
    [TENANT_ID, devUserId]);
  const devActor = devActorRow.rows[0]?.id;
  if (!devActor) { console.error('❌ user-actor do dev não encontrado.'); process.exit(1); }

  const O = randomUUID(); const GA = randomUUID();
  const ids: Record<string, string> = {};
  const cleanup = async () => {
    await pool.query(`DELETE FROM events WHERE tenant_id=$1 AND title LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
    await pool.query(`DELETE FROM follows WHERE tenant_id=$1 AND follower_actor_id=$2 AND followed_actor_id=$3`, [TENANT_ID, devActor, O]);
    await pool.query(`DELETE FROM group_members WHERE tenant_id=$1 AND group_id IN (SELECT id FROM groups WHERE tenant_id=$1 AND name LIKE $2)`, [TENANT_ID, `${MARKER}-%`]);
    await pool.query(`DELETE FROM actors WHERE tenant_id=$1 AND actor_type='group' AND display_name LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
    await pool.query(`DELETE FROM groups WHERE tenant_id=$1 AND name LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
    await pool.query(`DELETE FROM actors WHERE tenant_id=$1 AND display_name LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
  };
  await cleanup();

  try {
    await pool.query(`INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`,
      [O, TENANT_ID, `${MARKER}-organizer`, devActor]);
    await pool.query(`INSERT INTO follows (tenant_id, follower_actor_id, followed_actor_id) VALUES ($1,$2,$3)`, [TENANT_ID, devActor, O]);
    const g = await pool.query<{ id: string }>(`INSERT INTO groups (tenant_id, name, owner_actor_id) VALUES ($1,$2,$3) RETURNING id::text AS id`, [TENANT_ID, `${MARKER}-grupo`, O]);
    const groupId = g.rows[0].id;
    await pool.query(`INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, group_id, responsible_actor_id) VALUES ($1,$2,'group',$3,$1,$4,$5)`,
      [GA, TENANT_ID, `${MARKER}-group-actor`, groupId, devActor]);
    await pool.query(`INSERT INTO group_members (tenant_id, group_id, user_id) VALUES ($1,$2,$3)`, [TENANT_ID, groupId, devUserId]);

    const seed = async (organizer: string, vis: string, st: string, atype: string, meta = '{}'): Promise<void> => {
      const id = randomUUID();
      await pool.query(
        `INSERT INTO events (id, tenant_id, actor_id, actor_type, event_type, title, status, visibility, metadata)
         VALUES ($1,$2,$3,$4,'social',$5,$6,$7,$8::jsonb)`,
        [id, TENANT_ID, organizer, atype, `${MARKER}-${vis}-${st}`, st, vis, meta]);
      ids[`${vis}-${st}`] = id;
    };
    await seed(O, 'public', 'published', 'page', JSON.stringify({ regional: { city_id: CITY_X } }));
    await seed(O, 'public', 'draft', 'page');
    await seed(O, 'private', 'published', 'page');
    await seed(O, 'unlisted', 'published', 'page');
    await seed(GA, 'group', 'published', 'group');
    await seed(O, 'followers', 'published', 'page');

    const { eventsService } = await import('../modules/events/events.service');
    const search = (f: any) => eventsService.searchEvents(TENANT_ID, f);

    console.log('\n— SEARCH behavioral: herda o piso B1–B4 (público + group-membro + followers-follow) —');
    const asDev = mineTitles(await search({ discoveryUserId: devUserId, limit: 1000 }) as any);
    const asStranger = mineTitles(await search({ discoveryUserId: STRANGER_USER_ID, limit: 1000 }) as any);
    const asAnon = mineTitles(await search({ limit: 1000 }) as any);
    note(`dev=${asDev.join(', ')} · estranho=${asStranger.join(', ')} · anônimo=${asAnon.join(', ')}`);
    record('S1 dev vê public+published, group+published (membro), followers+published (follow)',
      asDev.includes('public-published') && asDev.includes('group-published') && asDev.includes('followers-published'));
    record('S2 dev NÃO vê draft/private/unlisted (piso)',
      !asDev.includes('public-draft') && !asDev.includes('private-published') && !asDev.includes('unlisted-published'));
    record('S3 estranho vê só public+published (não membro/não follower)',
      asStranger.length === 1 && asStranger[0] === 'public-published');
    record('S4 anônimo (sem discoveryUserId) vê só public+published', asAnon.length === 1 && asAnon[0] === 'public-published');
    const byCity = mineTitles(await search({ discoveryUserId: devUserId, cityId: CITY_X, limit: 1000 }) as any);
    const byOtherCity = mineTitles(await search({ discoveryUserId: devUserId, cityId: '22222222-2222-4222-8222-222222222222', limit: 1000 }) as any);
    record('S5 filtro regional preservado: cityId=X traz o público da cidade; cityId=outro não traz',
      byCity.includes('public-published') && byOtherCity.length === 0, `X=${byCity.join('|')} outro=${byOtherCity.join('|')}`);

    console.log('\n— COMPARE: a régua (canViewEvent por id; 404 se algum invisível) — predicado real —');
    const { canViewEvent } = await import('../core/events/event-visibility.service');
    const allVisible = [ids['public-published'], ids['group-published'], ids['followers-published']];
    const mixed = [ids['public-published'], ids['private-published']];
    const checks = async (idList: string[], caller: string | null) =>
      (await Promise.all(idList.map((id) => canViewEvent(TENANT_ID, id, caller))));
    record('C1 todos visíveis ao dev → compare passaria (todos canViewEvent=true)',
      (await checks(allVisible, devUserId)).every((v) => v === true));
    record('C2 mistura visível+private → algum false → rota 404 (sem parcial)',
      (await checks(mixed, devUserId)).some((v) => v === false));
    record('C3 inexistente no lote → false → 404', (await canViewEvent(TENANT_ID, randomUUID(), devUserId)) === false);
    record('C4 group/followers sem relação (estranho) no lote → false → 404',
      (await checks([ids['group-published'], ids['followers-published']], STRANGER_USER_ID)).every((v) => v === false));
  } finally {
    await cleanup();
  }

  console.log('\n— Estrutural —');
  const svc = readFileSync(join(process.cwd(), 'src/modules/events/events.service.ts'), 'utf8');
  const route = readFileSync(join(process.cwd(), 'src/modules/events/events.routes.ts'), 'utf8');
  const dash = readFileSync(join(process.cwd(), 'src/modules/events/event-metrics-dashboard.service.ts'), 'utf8');
  record('E1 searchEvents tem piso status published/active + visibility público/group/followers',
    /status IN \('published','active'\)/.test(svc) && /visibility = 'public'/.test(svc) && /group_members gm/.test(svc) && /follows f/.test(svc));
  record('E2 search usa membership/follow server-side (gm.user_id / fa.user_id = discoveryUserId), não query/body',
    /gm\.user_id = \$/.test(svc) && /fa\.user_id = \$/.test(svc) && /discoveryUserId: \(req\.user as/.test(route));
  record('E3 compare roda canViewEvent por eventId ANTES de compareEvents, 404 sem parcial',
    /for \(const eventId of eventIds\)[\s\S]{0,200}?canViewEvent\(req\.tenant\.id, eventId, callerUserId\)[\s\S]{0,120}?status\(404\)/.test(route));
  record('E4 compareEvents service NÃO toca Bank/ledger (read-only de métricas)',
    !/bank_ledger|bank_transactions|bank_splits|INSERT|UPDATE|DELETE/.test(dash));

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
  console.log('✨ search herda piso B1–B4 + compare herda canViewEvent (404 sem parcial) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
