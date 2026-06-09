/**
 * E2E F6.5.6b-B3 · GROUP-SCOPED DISCOVERY de GET /events (DECISION-0113, classe H)
 *
 * B1 = piso público; B2 = organizer dashboard. B3 abre 'group' na DISCOVERY: um evento visibility='group'
 * aparece na listagem pública SÓ para quem é MEMBRO do grupo dono (group_members por user_id, derivado de
 * req.user — NUNCA actorId declarado). Caminho material: event.actor_id → actors.id → actors.group_id →
 * group_members.group_id + group_members.user_id = caller. group draft NÃO aparece na discovery (piso de status).
 *
 * Prova (fixtures REAIS: 1 grupo + 1 group-actor + membership do dev + eventos):
 *   membro vê group+published; não-membro/anônimo não vê; group+draft fica fora; visibility=group estreita;
 *   public+published continua para todos; private/unlisted/followers seguem fora.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-events-group-scoped-f6-5-6b-3.ts
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
const MARKER = 'E2E-B3GRP';

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

  // limpeza preventiva de restos
  await pool.query(`DELETE FROM events WHERE tenant_id=$1 AND title LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
  await pool.query(`DELETE FROM groups WHERE tenant_id=$1 AND name LIKE $2`, [TENANT_ID, `${MARKER}-%`]);

  let groupId = '';
  let groupActorId = '';
  try {
    // 1) grupo (owner = dev actor existente)
    const g = await pool.query<{ id: string }>(
      `INSERT INTO groups (tenant_id, name, owner_actor_id) VALUES ($1, $2, $3) RETURNING id::text AS id`,
      [TENANT_ID, `${MARKER}-grupo`, devActor]);
    groupId = g.rows[0].id;
    // 2) group-actor (actor_type='group', group_id = grupo)
    groupActorId = randomUUID(); // chk_actors_actor_id_equals_id: id === actor_id
    await pool.query(
      `INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, group_id, responsible_actor_id)
       VALUES ($1, $2, 'group', $3, $1, $4, $5)`,
      [groupActorId, TENANT_ID, `${MARKER}-group-actor`, groupId, devActor]);
    // 3) dev é MEMBRO do grupo (membership por user_id)
    await pool.query(
      `INSERT INTO group_members (tenant_id, group_id, user_id) VALUES ($1, $2, $3)`,
      [TENANT_ID, groupId, devUserId]);
    // 4) eventos sob o group-actor
    for (const [vis, st] of [['group', 'published'], ['group', 'draft'], ['public', 'published']] as Array<[string, string]>) {
      await pool.query(
        `INSERT INTO events (id, tenant_id, actor_id, actor_type, event_type, title, status, visibility)
         VALUES (gen_random_uuid(), $1, $2, 'group', 'social', $3, $4, $5)`,
        [TENANT_ID, groupActorId, `${MARKER}-${vis}-${st}`, st, vis]);
    }

    const { eventRepository } = await import('../modules/events/event.repository');
    const list = (f: any) => eventRepository.listEvents(TENANT_ID, { visibilityMode: 'public_discovery', limit: 100000, ...f });

    console.log('\n— A behavioral REAL: membership vem do user, não de actorId declarado —');
    const asMember = mineTitles(await list({ discoveryUserId: devUserId }) as any);
    const asStranger = mineTitles(await list({ discoveryUserId: STRANGER_USER_ID }) as any);
    const asAnon = mineTitles(await list({}) as any);
    note(`membro=${asMember.join(', ')} · estranho=${asStranger.join(', ')} · anônimo=${asAnon.join(', ')}`);

    record('A1 MEMBRO vê group+published do grupo (membership material via group_members)',
      asMember.includes('group-published'));
    record('A2 MEMBRO NÃO vê group+draft na discovery (piso de status published/active)',
      !asMember.includes('group-draft'));
    record('A3 não-membro (estranho) NÃO vê group+published', !asStranger.includes('group-published'));
    record('A4 anônimo (sem discoveryUserId) NÃO vê group', !asAnon.includes('group-published'));
    record('A5 public+published continua visível para membro, estranho e anônimo',
      asMember.includes('public-published') && asStranger.includes('public-published') && asAnon.includes('public-published'));

    console.log('\n— B behavioral: cliente visibility=group estreita; não amplia sem membership —');
    const memberGroupOnly = mineTitles(await list({ discoveryUserId: devUserId, visibility: 'group' }) as any);
    const strangerGroupOnly = mineTitles(await list({ discoveryUserId: STRANGER_USER_ID, visibility: 'group' }) as any);
    record('B1 membro + visibility=group → só group+published (não traz o public)',
      memberGroupOnly.length === 1 && memberGroupOnly[0] === 'group-published', `got=${memberGroupOnly.join('|')}`);
    record('B2 não-membro + visibility=group → vazio (não amplia para group sem membership)',
      strangerGroupOnly.length === 0, `got=${strangerGroupOnly.join('|')}`);
    const memberDraft = mineTitles(await list({ discoveryUserId: devUserId, status: 'DRAFT' as any }) as any);
    record('B3 membro + status=DRAFT → vazio (group draft fora da discovery, mesmo membro)',
      memberDraft.length === 0, `got=${memberDraft.join('|')}`);
  } finally {
    // cleanup reverse-FK: events → group_members → group-actor → grupo
    await pool.query(`DELETE FROM events WHERE tenant_id=$1 AND title LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
    if (groupId) await pool.query(`DELETE FROM group_members WHERE tenant_id=$1 AND group_id=$2`, [TENANT_ID, groupId]);
    if (groupActorId) await pool.query(`DELETE FROM actors WHERE id=$1`, [groupActorId]);
    if (groupId) await pool.query(`DELETE FROM groups WHERE id=$1`, [groupId]);
  }

  console.log('\n— C estrutural: membership por user_id (group_members), nunca actorId declarado —');
  const repo = readFileSync(join(process.cwd(), 'src/modules/events/event.repository.ts'), 'utf8');
  const route = readFileSync(join(process.cwd(), 'src/modules/events/events-sprint76.routes.ts'), 'utf8');
  const myOrders = readFileSync(join(process.cwd(), 'src/modules/my-orders/my-orders.service.ts'), 'utf8');
  record('C1 repo: subquery group via group_members.user_id + actors.group_id (membership material)',
    /JOIN group_members gm ON gm\.group_id = a\.group_id/.test(repo) && /gm\.user_id = \$/.test(repo) && /a\.group_id IS NOT NULL/.test(repo));
  record('C2 repo: group só abre com discoveryUserId presente (sem user → só public)',
    /wantGroup && filters\.discoveryUserId/.test(repo));
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
  console.log('✨ Group-scoped discovery (membro vê group; não-membro não; draft fora; membership por user_id) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
