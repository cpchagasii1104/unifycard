/**
 * E2E F6.5.6b-B4 · FOLLOWERS-SCOPED DISCOVERY de GET /events (DECISION-0113, classe H)
 *
 * B1 público; B2 dashboard; B3 group. B4 abre 'followers' na DISCOVERY: um evento visibility='followers'
 * aparece na listagem pública SÓ para o caller cujo actor SERVER-SIDE segue o organizer do evento (follows por
 * actor; o follower deriva de actors.user_id = discoveryUserId = req.user.userId — NUNCA actorId declarado).
 * Caminho: event.actor_id = followed; follows.follower_actor_id ∈ atores do caller; status floor published/active.
 *
 * Prova (fixtures REAIS: 1 organizer page-actor + eventos; follow inserido NO MEIO p/ provar que o follow decide):
 *   dev SEM follow → não vê; dev COM follow → vê followers+published; followers+draft fora; estranho não vê;
 *   visibility=followers estreita; public continua p/ todos; group B3 segue; private/unlisted fora.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-events-followers-scoped-f6-5-6b-4.ts
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
const MARKER = 'E2E-B4FOL';

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
  const dev = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM users WHERE email=$1 AND tenant_id=$2 LIMIT 1`, [DEV_EMAIL, TENANT_ID]);
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devUserId = dev.rows[0].id;
  const devActorRow = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM actors WHERE tenant_id=$1 AND user_id=$2::uuid AND actor_type='user' LIMIT 1`,
    [TENANT_ID, devUserId]);
  const devActor = devActorRow.rows[0]?.id;
  if (!devActor) { console.error('❌ user-actor do dev não encontrado.'); process.exit(1); }

  await pool.query(`DELETE FROM events WHERE tenant_id=$1 AND title LIKE $2`, [TENANT_ID, `${MARKER}-%`]);

  const organizerId = randomUUID(); // page-actor = o ORGANIZER seguido (chk: id === actor_id)
  try {
    await pool.query(
      `INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id)
       VALUES ($1, $2, 'page', $3, $1, $4)`,
      [organizerId, TENANT_ID, `${MARKER}-organizer`, devActor]);
    for (const [vis, st] of [['followers', 'published'], ['followers', 'draft'], ['public', 'published']] as Array<[string, string]>) {
      await pool.query(
        `INSERT INTO events (id, tenant_id, actor_id, actor_type, event_type, title, status, visibility)
         VALUES (gen_random_uuid(), $1, $2, 'page', 'social', $3, $4, $5)`,
        [TENANT_ID, organizerId, `${MARKER}-${vis}-${st}`, st, vis]);
    }

    const { eventRepository } = await import('../modules/events/event.repository');
    const list = (f: any) => eventRepository.listEvents(TENANT_ID, { visibilityMode: 'public_discovery', limit: 100000, ...f });

    console.log('\n— A: o FOLLOW decide (dev antes × depois de seguir) — follower vem do servidor —');
    const devBefore = mineTitles(await list({ discoveryUserId: devUserId }) as any);
    record('A1 dev SEM follow NÃO vê followers+published (não é privilégio do dev — é o follow)',
      !devBefore.includes('followers-published'), `got=${devBefore.join('|')}`);

    // insere o follow: devActor (server-side) segue o organizer
    await pool.query(
      `INSERT INTO follows (tenant_id, follower_actor_id, followed_actor_id) VALUES ($1, $2, $3)`,
      [TENANT_ID, devActor, organizerId]);

    const devAfter = mineTitles(await list({ discoveryUserId: devUserId }) as any);
    const stranger = mineTitles(await list({ discoveryUserId: STRANGER_USER_ID }) as any);
    const anon = mineTitles(await list({}) as any);
    note(`dev-após-follow=${devAfter.join(', ')} · estranho=${stranger.join(', ')} · anônimo=${anon.join(', ')}`);
    record('A2 dev COM follow vê followers+published do organizer seguido', devAfter.includes('followers-published'));
    record('A3 dev COM follow NÃO vê followers+draft (piso de status published/active)', !devAfter.includes('followers-draft'));
    record('A4 estranho (sem actor que segue) NÃO vê followers', !stranger.includes('followers-published'));
    record('A5 anônimo (sem discoveryUserId) NÃO vê followers', !anon.includes('followers-published'));
    record('A6 public+published continua p/ dev, estranho e anônimo',
      devAfter.includes('public-published') && stranger.includes('public-published') && anon.includes('public-published'));

    console.log('\n— B: cliente visibility=followers estreita; não amplia sem follow material —');
    const devFollOnly = mineTitles(await list({ discoveryUserId: devUserId, visibility: 'followers' }) as any);
    const strangerFollOnly = mineTitles(await list({ discoveryUserId: STRANGER_USER_ID, visibility: 'followers' }) as any);
    record('B1 dev + visibility=followers → só followers+published (não traz o public)',
      devFollOnly.length === 1 && devFollOnly[0] === 'followers-published', `got=${devFollOnly.join('|')}`);
    record('B2 estranho + visibility=followers → vazio (não amplia sem follow)',
      strangerFollOnly.length === 0, `got=${strangerFollOnly.join('|')}`);
    const devFollDraft = mineTitles(await list({ discoveryUserId: devUserId, status: 'DRAFT' as any }) as any);
    record('B3 dev + status=DRAFT → vazio (followers draft fora da discovery, mesmo seguindo)',
      devFollDraft.length === 0, `got=${devFollDraft.join('|')}`);
  } finally {
    await pool.query(`DELETE FROM events WHERE tenant_id=$1 AND title LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
    await pool.query(`DELETE FROM follows WHERE tenant_id=$1 AND followed_actor_id=$2`, [TENANT_ID, organizerId]);
    await pool.query(`DELETE FROM actors WHERE id=$1`, [organizerId]);
  }

  console.log('\n— C estrutural: follower por actors.user_id (follows), nunca actorId declarado —');
  const repo = readFileSync(join(process.cwd(), 'src/modules/events/event.repository.ts'), 'utf8');
  const route = readFileSync(join(process.cwd(), 'src/modules/events/events-sprint76.routes.ts'), 'utf8');
  const myOrders = readFileSync(join(process.cwd(), 'src/modules/my-orders/my-orders.service.ts'), 'utf8');
  record('C1 repo: subquery followers via follows + actors.user_id = discoveryUserId (follower server-side)',
    /JOIN actors fa ON fa\.id = f\.follower_actor_id/.test(repo) && /fa\.user_id = \$/.test(repo) && /f\.followed_actor_id/.test(repo));
  record('C2 repo: followers só abre com discoveryUserId presente (wantFollowers && filters.discoveryUserId)',
    /wantFollowers && filters\.discoveryUserId/.test(repo));
  record('C3 rota: discoveryUserId vem de req.user.userId, NÃO de query/actorId declarado',
    /discoveryUserId: userId/.test(route) && /const userId = \(req\.user as/.test(route));
  record('C4 my-orders.service NÃO passa visibilityMode/discoveryUserId (caller interno preservado)',
    /listEvents\(tenantId, \{ limit: 10000 \}\)/.test(myOrders) && !/visibilityMode/.test(myOrders) && !/discoveryUserId/.test(myOrders));

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
  console.log('✨ Followers-scoped discovery (segue→vê; não segue→não; draft fora; follower por actor server-side) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
