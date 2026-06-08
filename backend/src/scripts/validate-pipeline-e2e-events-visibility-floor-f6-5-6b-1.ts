/**
 * E2E F6.5.6b-B1 · PISO DE DISCOVERY PÚBLICA de GET /events (DECISION-0113, classe H deny-first)
 *
 * eventRepository.listEvents NÃO tinha piso → GET /events vazava draft/private/group/followers (status do
 * cliente era o único "piso"). Fix B1 deny-first: param `discoveryFloor` (default OFF → callers internos como
 * my-orders intactos); quando TRUE (só GET /events), server FORÇA visibility='public' AND status IN
 * ('published','active'); o status do cliente só ESTREITA dentro do piso (draft → interseção vazia). NÃO abre
 * organizer/group/followers/unlisted/private aqui (B2/B3/B4/canal-5). 'declared' fora por decisão Clayton.
 *
 * Prova:
 *   A behavioral REAL — listEvents(discoveryFloor:true) retorna EXATAMENTE os public+published/active (conta vs
 *     SQL cru); listEvents({}) (sem piso) retorna o conjunto completo (my-orders intacto).
 *   B estrutural — branch discoveryFloor com visibility='public' + status IN published/active + interseção segura;
 *     GET /events passa discoveryFloor:true; my-orders NÃO passa; repo default-off.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-events-visibility-floor-f6-5-6b-1.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function note(msg: string): void { console.log(`  ℹ️  ${msg}`); }

const MARKER = 'E2E-VISFLOOR';
// 5 fixtures: 2 dentro do piso (public+published, public+active) · 3 fora (draft/private/group)
const SEEDS: Array<[string, string]> = [
  ['public', 'published'],   // IN
  ['public', 'active'],      // IN ('active' faz parte do piso — prova além de 'published')
  ['public', 'draft'],       // OUT (status fora do piso)
  ['private', 'published'],  // OUT (visibility)
  ['group', 'published'],    // OUT (visibility)
];

async function seed(): Promise<void> {
  await pool.query(`DELETE FROM events WHERE tenant_id=$1 AND title LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
  const actor = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM actors WHERE tenant_id=$1 AND actor_type='user' LIMIT 1`, [TENANT_ID]);
  if (actor.rowCount === 0) throw new Error('Sem user-actor para semear fixtures de evento.');
  const actorId = actor.rows[0].id;
  for (const [vis, st] of SEEDS) {
    await pool.query(
      `INSERT INTO events (id, tenant_id, actor_id, actor_type, event_type, title, status, visibility)
       VALUES (gen_random_uuid(), $1, $2, 'user', 'social', $3, $4, $5)`,
      [TENANT_ID, actorId, `${MARKER}-${vis}-${st}`, st, vis]
    );
  }
}
async function cleanup(): Promise<void> {
  await pool.query(`DELETE FROM events WHERE tenant_id=$1 AND title LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
}
const mine = (events: Array<{ title: string }>): Array<{ title: string }> =>
  events.filter((e) => e.title && e.title.startsWith(`${MARKER}-`));

async function main(): Promise<void> {
  await seed();
  try {
    console.log('\n— A behavioral REAL (5 fixtures semeados): piso devolve só public+published/active —');
    const { eventRepository } = await import('../modules/events/event.repository');
    const floored = await eventRepository.listEvents(TENANT_ID, { discoveryFloor: true, limit: 100000 });
    const unfloored = await eventRepository.listEvents(TENANT_ID, { limit: 100000 });
    const fMine = mine(floored as any);
    const uMine = mine(unfloored as any);
    note(`fixtures: piso=${fMine.map((e) => e.title.replace(MARKER + '-', '')).join(', ')} · sem-piso=${uMine.length}`);

    record('A1 piso retorna EXATAMENTE os 2 public+published/active (public-published + public-active)',
      fMine.length === 2
      && fMine.some((e) => e.title.endsWith('public-published'))
      && fMine.some((e) => e.title.endsWith('public-active')),
      `titles=${fMine.map((e) => e.title).join('|')}`);
    record('A2 piso NÃO devolve draft/private/group (nenhum fixture fora do piso vazou)',
      !fMine.some((e) => e.title.endsWith('public-draft') || e.title.endsWith('private-published') || e.title.endsWith('group-published')));
    record('A3 sem piso (caminho my-orders) devolve os 5 fixtures (caller interno intacto)',
      uMine.length === 5, `n=${uMine.length}`);

    console.log('\n— A behavioral: status do cliente só ESTREITA dentro do piso (draft → vazio) —');
    const flooredDraft = await eventRepository.listEvents(TENANT_ID, { discoveryFloor: true, status: 'DRAFT' as any, limit: 100000 });
    record('A4 discoveryFloor + status=DRAFT → 0 fixtures (cliente não amplia o piso para draft)',
      mine(flooredDraft as any).length === 0, `n=${mine(flooredDraft as any).length}`);
  } finally {
    await cleanup();
  }

  console.log('\n— B estrutural: o piso é server-side, default-off, e os callers certos —');
  const repo = readFileSync(join(process.cwd(), 'src/modules/events/event.repository.ts'), 'utf8');
  const route = readFileSync(join(process.cwd(), 'src/modules/events/events-sprint76.routes.ts'), 'utf8');
  const myOrders = readFileSync(join(process.cwd(), 'src/modules/my-orders/my-orders.service.ts'), 'utf8');
  record('B1 repo: branch discoveryFloor força visibility=\'public\'',
    /if \(filters\.discoveryFloor\)/.test(repo) && /visibility = 'public'/.test(repo));
  record('B2 repo: piso de status published+active + interseção vazia segura (1 = 0)',
    /\['published', 'active'\]/.test(repo) && /conditions\.push\('1 = 0'\)/.test(repo));
  record('B3 repo: default-off — status livre só quando NÃO discoveryFloor (else if filters.status)',
    /\} else if \(filters\.status\) \{/.test(repo));
  record('B4 GET /events (sprint76) passa discoveryFloor: true',
    /const filters: any = \{ discoveryFloor: true \}/.test(route));
  record('B5 my-orders.service NÃO passa discoveryFloor (caller interno preservado)',
    /listEvents\(tenantId, \{ limit: 10000 \}\)/.test(myOrders) && !/discoveryFloor/.test(myOrders));

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
  console.log('✨ Piso de discovery (public+published/active; cliente estreita; my-orders intacto) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
