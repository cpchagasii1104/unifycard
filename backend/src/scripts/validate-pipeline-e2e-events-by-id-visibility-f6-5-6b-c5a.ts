/**
 * E2E F6.5.6b-CANAL5-A · canViewEvent para acesso por ID (DECISION-0113, canal 5)
 *
 * A listagem (B1–B4) respeita visibility, mas GET /events/:id ignorava → IDOR. canViewEvent (core/events) espelha
 * a régua: organizer representável vê tudo do próprio; senão só published/active → public/unlisted (autenticado),
 * group (membro), followers (follower server-side); private/draft/declared/ended/cancelled → só organizer; deny→404.
 *
 * Prova (fixtures REAIS): organizer O (page, dev NÃO representa, mas dev SEGUE O) + grupo GA (dev membro) +
 * eventos sob O/devActor/GA cobrindo a matriz. callerUserId = dev (representa devActor; outsider de O/GA) ·
 * STRANGER (não-membro/não-follower) · null (anônimo). Eixo de autoridade = event.actor_id (NÃO created_by_*).
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-events-by-id-visibility-f6-5-6b-c5a.ts
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
const MARKER = 'E2E-C5A';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
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
    `SELECT id::text AS id FROM users WHERE email=$1 AND tenant_id=$2 LIMIT 1`, [DEV_EMAIL, TENANT_ID]);
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devUserId = dev.rows[0].id;
  const devActorRow = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM actors WHERE tenant_id=$1 AND user_id=$2::uuid AND actor_type='user' LIMIT 1`,
    [TENANT_ID, devUserId]);
  const devActor = devActorRow.rows[0]?.id;
  if (!devActor) { console.error('❌ user-actor do dev não encontrado.'); process.exit(1); }

  const cleanup = async () => {
    // ordem reverse-FK: events → follows → group_members → group-actor → groups → page-actor
    // (groups.owner_actor_id → page-actor O; actors.group_id → groups → owner O ⇒ apaga GA, depois G, depois O)
    await pool.query(`DELETE FROM events WHERE tenant_id=$1 AND title LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
    await pool.query(`DELETE FROM follows WHERE tenant_id=$1 AND follower_actor_id=$2 AND followed_actor_id IN (SELECT id FROM actors WHERE tenant_id=$1 AND display_name LIKE $3)`, [TENANT_ID, devActor, `${MARKER}-%`]);
    await pool.query(`DELETE FROM group_members WHERE tenant_id=$1 AND group_id IN (SELECT id FROM groups WHERE tenant_id=$1 AND name LIKE $2)`, [TENANT_ID, `${MARKER}-%`]);
    await pool.query(`DELETE FROM actors WHERE tenant_id=$1 AND actor_type='group' AND display_name LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
    await pool.query(`DELETE FROM groups WHERE tenant_id=$1 AND name LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
    await pool.query(`DELETE FROM actors WHERE tenant_id=$1 AND display_name LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
  };
  await cleanup();

  const O = randomUUID();   // organizer page-actor (dev NÃO representa; dev SEGUE)
  const GA = randomUUID();  // group-actor (dev é membro do grupo)
  const ev: Record<string, string> = {};
  const seedEvent = async (organizer: string, vis: string, status: string, actorType: string): Promise<void> => {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO events (id, tenant_id, actor_id, actor_type, event_type, title, status, visibility)
       VALUES ($1, $2, $3, $4, 'social', $5, $6, $7)`,
      [id, TENANT_ID, organizer, actorType, `${MARKER}-${vis}-${status}-${organizer === devActor ? 'own' : organizer === GA ? 'grp' : 'O'}`, status, vis]);
    ev[`${vis}-${status}-${organizer === devActor ? 'own' : organizer === GA ? 'grp' : 'O'}`] = id;
  };

  try {
    // organizer O (page) — dev NÃO representa; é o dono do grupo (p/ dev ser MEMBRO simples, não dono). dev SEGUE O.
    await pool.query(
      `INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`,
      [O, TENANT_ID, `${MARKER}-organizer`, devActor]);
    await pool.query(`INSERT INTO follows (tenant_id, follower_actor_id, followed_actor_id) VALUES ($1,$2,$3)`, [TENANT_ID, devActor, O]);
    // grupo dono = O (não dev) + group-actor + dev como MEMBRO SIMPLES (não dono → não representa)
    const g = await pool.query<{ id: string }>(
      `INSERT INTO groups (tenant_id, name, owner_actor_id) VALUES ($1, $2, $3) RETURNING id::text AS id`,
      [TENANT_ID, `${MARKER}-grupo`, O]);
    const groupId = g.rows[0].id;
    // responsible_actor_id deve ser HUMANO (=devActor); a REPRESENTAÇÃO de grupo vem de groups.owner_actor_id (=O),
    // não do responsible → dev é membro simples, NÃO representa GA (canRepresentActor usa safeCheckOwnership('groups')).
    await pool.query(
      `INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, group_id, responsible_actor_id) VALUES ($1,$2,'group',$3,$1,$4,$5)`,
      [GA, TENANT_ID, `${MARKER}-group-actor`, groupId, devActor]);
    await pool.query(`INSERT INTO group_members (tenant_id, group_id, user_id) VALUES ($1,$2,$3)`, [TENANT_ID, groupId, devUserId]);

    // eventos sob O (outsider), devActor (organizer próprio) e GA (grupo)
    await seedEvent(O, 'public', 'published', 'page');
    await seedEvent(O, 'public', 'active', 'page');
    await seedEvent(O, 'public', 'draft', 'page');
    await seedEvent(devActor, 'public', 'draft', 'user');
    await seedEvent(O, 'public', 'declared', 'page');
    await seedEvent(devActor, 'public', 'declared', 'user');
    await seedEvent(O, 'public', 'ended', 'page');
    await seedEvent(devActor, 'public', 'ended', 'user');
    await seedEvent(O, 'unlisted', 'published', 'page');
    await seedEvent(O, 'unlisted', 'draft', 'page');
    await seedEvent(devActor, 'unlisted', 'draft', 'user');
    await seedEvent(O, 'private', 'published', 'page');
    await seedEvent(devActor, 'private', 'published', 'user');
    await seedEvent(GA, 'group', 'published', 'group');
    await seedEvent(GA, 'group', 'draft', 'group');
    await seedEvent(O, 'followers', 'published', 'page');
    await seedEvent(O, 'followers', 'draft', 'page');
    await seedEvent(devActor, 'followers', 'draft', 'user');

    const { canViewEvent } = await import('../core/events/event-visibility.service');
    const view = (label: string, caller: string | null) => canViewEvent(TENANT_ID, ev[label], caller);

    console.log('\n— public: published/active abrem; draft/declared/ended só organizer —');
    record('1 public+published → outsider (dev) vê', (await view('public-published-O', devUserId)) === true);
    record('1b public+published → estranho vê', (await view('public-published-O', STRANGER_USER_ID)) === true);
    record('2 public+active → outsider vê', (await view('public-active-O', devUserId)) === true);
    record('3 public+draft → outsider 404 (false); organizer vê',
      (await view('public-draft-O', devUserId)) === false && (await view('public-draft-own', devUserId)) === true);
    record('4 public+declared → outsider 404; organizer vê',
      (await view('public-declared-O', devUserId)) === false && (await view('public-declared-own', devUserId)) === true);
    record('5 public+ended → outsider 404; organizer vê',
      (await view('public-ended-O', devUserId)) === false && (await view('public-ended-own', devUserId)) === true);

    console.log('\n— unlisted: por link/id ao autenticado; draft só organizer; anônimo não —');
    record('6 unlisted+published → autenticado (dev e estranho) vê; anônimo (null) NÃO',
      (await view('unlisted-published-O', devUserId)) === true
      && (await view('unlisted-published-O', STRANGER_USER_ID)) === true
      && (await view('unlisted-published-O', null)) === false);
    record('7 unlisted+draft → outsider 404; organizer vê',
      (await view('unlisted-draft-O', devUserId)) === false && (await view('unlisted-draft-own', devUserId)) === true);

    console.log('\n— private/group/followers —');
    record('8 private+published → outsider 404; organizer vê',
      (await view('private-published-O', devUserId)) === false && (await view('private-published-own', devUserId)) === true);
    record('9 group+published → membro (dev) vê; não-membro (estranho) 404',
      (await view('group-published-grp', devUserId)) === true && (await view('group-published-grp', STRANGER_USER_ID)) === false);
    record('10 group+draft → membro simples 404 (status, não representa); não-membro 404',
      (await view('group-draft-grp', devUserId)) === false && (await view('group-draft-grp', STRANGER_USER_ID)) === false);
    record('11 followers+published → follower (dev segue O) vê; não-follower (estranho) 404',
      (await view('followers-published-O', devUserId)) === true && (await view('followers-published-O', STRANGER_USER_ID)) === false);
    record('12 followers+draft → follower 404 (status); organizer próprio vê',
      (await view('followers-draft-O', devUserId)) === false && (await view('followers-draft-own', devUserId)) === true);

    console.log('\n— inexistente + eixo de autoridade —');
    record('13 ID inexistente → 404 indistinguível (false)', (await canViewEvent(TENANT_ID, randomUUID(), devUserId)) === false);
  } finally {
    await cleanup();
  }

  console.log('\n— C estrutural: eixo actor_id (não created_by_*); membership/follow server-side; readers gateados —');
  const helper = readFileSync(join(process.cwd(), 'src/core/events/event-visibility.service.ts'), 'utf8');
  const sprint76 = readFileSync(join(process.cwd(), 'src/modules/events/events-sprint76.routes.ts'), 'utf8');
  const core = readFileSync(join(process.cwd(), 'src/core/events/event.routes.ts'), 'utf8');
  record('14 helper usa canRepresentActor(... ev.actor_id) e NÃO created_by_global_user_id/company como eixo de view',
    /canRepresentActor\(tenantId, callerUserId, ev\.actor_id\)/.test(helper) && !/created_by_global_user_id|created_by_company/.test(helper));
  record('15 membership/follow derivam de callerUserId server-side (group_members.user_id / actors.user_id), não query/header',
    /gm\.user_id = \$3/.test(helper) && /fa\.user_id = \$3/.test(helper) && !/req\.query|req\.headers|req\.body/.test(helper));
  record('16 os 2 readers por ID chamam canViewEvent antes de retornar; 404 deny-first',
    /canViewEvent\(tenantId, req\.params\.id, callerUserId\)/.test(sprint76) && /canViewEvent\(req\.tenant\.id, req\.params\.id, callerUserId\)/.test(core));

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
  console.log('✨ canViewEvent por ID (herda B1–B4; unlisted por link; private/group/followers; 404 deny-first) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
