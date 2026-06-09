/**
 * E2E F6.5.6b-EVENTS-MONEY-READS · settlement/RFQ read gate (DECISION-0113, money não pega carona em visibility)
 *
 * GET /events/:id/settlement e GET /events/:eventId/rfqs(/:rfqId) vazavam dado financeiro/procurement por id
 * (só req.tenant). Agora herdam `assertCanReadEventMoney` (camada DUPLA): canViewEvent false → 404 não-leak;
 * visível mas NÃO representa o organizer (event.actor_id) → 403. canViewEvent só dá o 404; autoridade financeira
 * = canRepresentActor(organizer) (MVP organizer-only). POST settle (F3.1) e writes money INTOCADOS.
 *
 * Prova:
 *   A behavioral — assertCanReadEventMoney: organizer→ok; visível-não-organizer→403; invisível→404; inexistente→404.
 *   B estrutural — os 3 reads chamam assertCanReadEventMoney antes do read; POST settle intacto; canViewEvent não alterado.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-events-money-reads-authority-f6-5-6b-mr.ts
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
const MARKER = 'E2E-MR';

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

  const dev = await pool.query<{ id: string }>(`SELECT id::text AS id FROM users WHERE email=$1 AND tenant_id=$2 LIMIT 1`, [DEV_EMAIL, TENANT_ID]);
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devUserId = dev.rows[0].id;
  const devActorRow = await pool.query<{ id: string }>(`SELECT id::text AS id FROM actors WHERE tenant_id=$1 AND user_id=$2::uuid AND actor_type='user' LIMIT 1`, [TENANT_ID, devUserId]);
  const devActor = devActorRow.rows[0]?.id;
  if (!devActor) { console.error('❌ user-actor do dev não encontrado.'); process.exit(1); }

  await pool.query(`DELETE FROM events WHERE tenant_id=$1 AND title LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
  const O = randomUUID();
  const ev: Record<string, string> = {};
  try {
    await pool.query(`INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`,
      [O, TENANT_ID, `${MARKER}-organizer`, devActor]);
    const seed = async (org: string, vis: string, st: string, atype: string) => {
      const id = randomUUID();
      await pool.query(`INSERT INTO events (id, tenant_id, actor_id, actor_type, event_type, title, status, visibility) VALUES ($1,$2,$3,$4,'social',$5,$6,$7)`,
        [id, TENANT_ID, org, atype, `${MARKER}-${vis}-${st}-${org === devActor ? 'own' : 'O'}`, st, vis]);
      ev[`${vis}-${st}-${org === devActor ? 'own' : 'O'}`] = id;
    };
    await seed(devActor, 'public', 'published', 'user');  // organizer = dev
    await seed(devActor, 'private', 'published', 'user');  // organizer = dev (vê o próprio privado)
    await seed(O, 'public', 'published', 'page');          // visível ao dev (público), mas dev NÃO é organizer
    await seed(O, 'private', 'published', 'page');          // invisível ao dev (outsider)

    const { assertCanReadEventMoney } = await import('../core/events/event-visibility.service');
    const chk = (id: string, caller: string | null) => assertCanReadEventMoney(TENANT_ID, id, caller);

    console.log('\n— A behavioral: camada dupla (404 invisível/inexistente · 403 visível-sem-organizer) —');
    record('A1 organizer (dev) lê money do PRÓPRIO evento público → ok', (await chk(ev['public-published-own'], devUserId)).ok === true);
    record('A2 organizer (dev) lê money do PRÓPRIO evento privado → ok', (await chk(ev['private-published-own'], devUserId)).ok === true);
    const r3 = await chk(ev['public-published-O'], devUserId);
    record('A3 evento público VISÍVEL mas dev NÃO representa organizer → 403 (não 404)', !r3.ok && r3.status === 403, JSON.stringify(r3));
    const r4 = await chk(ev['private-published-O'], devUserId);
    record('A4 evento privado INVISÍVEL ao dev → 404 não-leak (não 403)', !r4.ok && r4.status === 404, JSON.stringify(r4));
    const r5 = await chk(randomUUID(), devUserId);
    record('A5 evento inexistente → 404 indistinguível', !r5.ok && r5.status === 404, JSON.stringify(r5));
    const r6 = await chk(ev['public-published-own'], STRANGER_USER_ID);
    record('A6 estranho no evento público do dev → 403 (vê o evento, não a money)', !r6.ok && r6.status === 403, JSON.stringify(r6));
    const r7 = await chk(ev['private-published-own'], STRANGER_USER_ID);
    record('A7 estranho no evento PRIVADO do dev → 404 (nem vê o evento)', !r7.ok && r7.status === 404, JSON.stringify(r7));
  } finally {
    await pool.query(`DELETE FROM events WHERE tenant_id=$1 AND title LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
    await pool.query(`DELETE FROM actors WHERE id=$1`, [O]);
  }

  console.log('\n— B estrutural —');
  const helper = readFileSync(join(process.cwd(), 'src/core/events/event-visibility.service.ts'), 'utf8');
  const settle = readFileSync(join(process.cwd(), 'src/modules/marketplace/event-settlement.routes.ts'), 'utf8');
  const rfq = readFileSync(join(process.cwd(), 'src/modules/events/event-rfq.routes.ts'), 'utf8');
  record('B1 helper assertCanReadEventMoney: canViewEvent→404, depois canRepresentActor(organizer)→403',
    /canViewEvent\(tenantId, eventId, callerUserId\)\)\) return \{ ok: false, status: 404 \}/.test(helper)
    && /canRepresentActor\(tenantId, callerUserId, organizerActorId\)/.test(helper)
    && /status: 403/.test(helper));
  record('B2 GET /events/:id/settlement chama assertCanReadEventMoney ANTES do getSettlementByEvent',
    settle.indexOf('assertCanReadEventMoney') >= 0 && settle.indexOf('assertCanReadEventMoney') < settle.indexOf('getSettlementByEvent(tenantId, eventId)'));
  record('B3 GET /events/:eventId/rfqs (list + individual) chamam assertCanReadEventMoney antes do read',
    (rfq.match(/assertCanReadEventMoney/g) || []).length >= 2
    && rfq.indexOf('assertCanReadEventMoney') < rfq.indexOf('getEventRFQs('));
  record('B4 POST /settlement/settle INTOCADO (mantém canRepresentActor próprio; sem assertCanReadEventMoney no write)',
    /canRepresentActor\(tenantId, userId, organizerActorId\)/.test(settle) && /settleEvent\(/.test(settle));
  record('B5 canViewEvent NÃO alterado (assinatura preservada)',
    /export async function canViewEvent\(/.test(helper));
  record('B6 money read NÃO usa permissão finance cross-actor (organizer-only MVP) e não toca bank',
    !/'financial:view_all_ledger'|'financial:execute_payout'|requirePermission/.test(helper) && !/bank_ledger|bank_transactions/.test(helper));

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
  console.log('✨ Money reads de events gateados (404 invisível · 403 sem organizer; POST settle intacto) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
