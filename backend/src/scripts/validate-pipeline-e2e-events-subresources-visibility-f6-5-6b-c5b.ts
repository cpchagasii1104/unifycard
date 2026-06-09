/**
 * E2E F6.5.6b-CANAL5-B · sub-resources não-money herdam canViewEvent (DECISION-0113, canal 5)
 *
 * canal-5-A gateou GET /events/:id. canal-5-B aplica o MESMO helper canViewEvent aos sub-resources NÃO-MONEY
 * de leitura por :eventId/:id (details/posts/stats/participants/metrics-GET/dashboard/occupancy/rsvp-status/
 * rsvp-counts/state-history). Sub-resource só abre se o evento-pai passar no canViewEvent; senão 404 não-leak.
 * Money (economy/closure/settlement/RFQ) e writes/lifecycle = STOP/D, NÃO tocados.
 *
 * Prova:
 *   A behavioral — canViewEvent (o predicado herdado) nega cross-user (public+published vê; private outsider 404).
 *     O comportamento ponta-a-ponta do predicado já está coberto 17/17 em canal-5-A; aqui é sanidade + estrutura.
 *   B estrutural — cada sub-resource não-money chama canViewEvent ANTES do read (gate-antes-da-leitura) com 404
 *     deny-first; eventId vem de params (não query/body); money routes (economy/closure) NÃO gateadas (STOP).
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-events-subresources-visibility-f6-5-6b-c5b.ts
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
const MARKER = 'E2E-C5B';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
// gate-antes-da-leitura: canViewEvent( deve aparecer nos chars imediatamente ANTES do read (marker único).
function gateImmediatelyBeforeRead(src: string, readMarker: string, lookback = 800): boolean {
  const r = src.indexOf(readMarker);
  if (r < 0) return false;
  return src.slice(Math.max(0, r - lookback), r).includes('canViewEvent(');
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

  await pool.query(`DELETE FROM events WHERE tenant_id=$1 AND title LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
  const O = randomUUID();
  try {
    await pool.query(
      `INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`,
      [O, TENANT_ID, `${MARKER}-organizer`, devActor]);
    const pubId = randomUUID(); const privId = randomUUID();
    await pool.query(`INSERT INTO events (id, tenant_id, actor_id, actor_type, event_type, title, status, visibility) VALUES ($1,$2,$3,'page','social',$4,'published','public')`,
      [pubId, TENANT_ID, O, `${MARKER}-pub`]);
    await pool.query(`INSERT INTO events (id, tenant_id, actor_id, actor_type, event_type, title, status, visibility) VALUES ($1,$2,$3,'page','social',$4,'published','private')`,
      [privId, TENANT_ID, O, `${MARKER}-priv`]);

    const { canViewEvent } = await import('../core/events/event-visibility.service');
    console.log('\n— A behavioral (sanidade do predicado herdado pelos sub-resources) —');
    record('A1 evento public+published → caller vê (sub-resource abriria)', (await canViewEvent(TENANT_ID, pubId, devUserId)) === true);
    record('A2 evento private → outsider 404 (sub-resource fecharia)', (await canViewEvent(TENANT_ID, privId, STRANGER_USER_ID)) === false);
    record('A3 evento private → organizer (dev representa? não — é outsider de O) 404', (await canViewEvent(TENANT_ID, privId, devUserId)) === false);
  } finally {
    await pool.query(`DELETE FROM events WHERE tenant_id=$1 AND title LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
    await pool.query(`DELETE FROM actors WHERE id=$1`, [O]);
  }

  console.log('\n— B estrutural: cada sub-resource não-money gateia ANTES do read; money NÃO gateado —');
  const ev = readFileSync(join(process.cwd(), 'src/modules/events/events.routes.ts'), 'utf8');
  const rsvp = readFileSync(join(process.cwd(), 'src/modules/events/events-rsvp.routes.ts'), 'utf8');
  const hist = readFileSync(join(process.cwd(), 'src/modules/events/events-state-history.routes.ts'), 'utf8');
  const economy = readFileSync(join(process.cwd(), 'src/modules/events/events-economy.routes.ts'), 'utf8');
  const closure = readFileSync(join(process.cwd(), 'src/modules/events/events-closure.routes.ts'), 'utf8');

  const subs: Array<[string, string, string]> = [
    ['details', ev, 'eventsService.getEvent('],
    ['posts', ev, 'getEventPosts('],
    ['stats', ev, 'event_attendees'],
    ['participants', ev, 'getEventParticipants('],
    ['metrics(GET)', ev, 'getEventMetricsSummary('],
    ['dashboard', ev, 'getEventDashboard('],
    ['occupancy', ev, 'getOccupancyStats('],
    ['rsvp/status', rsvp, 'getRSVPStatus('],
    ['rsvp/counts', rsvp, 'getRSVPCounts('],
    ['state-history', hist, 'SELECT id, status, created_at'],
  ];
  for (const [name, src, readMarker] of subs) {
    record(`B:${name} canViewEvent ANTES do read (gate-antes-da-leitura)`,
      gateImmediatelyBeforeRead(src, readMarker, 800));
  }

  record('B-404 todos os gates usam 404 deny-first (não 403) — events/rsvp/state-history',
    /canViewEvent[\s\S]{0,200}?status\(404\)/.test(ev) && /canViewEvent[\s\S]{0,200}?code\(404\)/.test(rsvp) && /canViewEvent[\s\S]{0,200}?status\(404\)/.test(hist));
  record('B-params eventId vem de req.params (não query/body/header)',
    /canViewEvent\(req\.tenant\.id, req\.params\.eventId/.test(ev) && /canViewEvent\(req\.tenant\.id, req\.params\.id/.test(ev) && /canViewEvent\(tenantId, eventId/.test(rsvp));
  record('B-MONEY economy/closure NÃO gateados (STOP financeiro próprio — não tocados)',
    !/canViewEvent/.test(economy) && !/canViewEvent/.test(closure));

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
  console.log('✨ Sub-resources não-money herdam canViewEvent (gate-antes-da-leitura; 404; money STOP) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
