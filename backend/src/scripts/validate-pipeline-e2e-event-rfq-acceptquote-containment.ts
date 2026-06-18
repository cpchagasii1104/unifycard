/**
 * E2E — R7b ACCEPTQUOTE P0 CONTAINMENT (DECISION-0113 / DECISION-0131 §B7 / Z2 · Clayton 2026-06-18).
 * NÃO MOVE DINHEIRO. NÃO redesenha o fluxo final — apenas prova a CONTENÇÃO fail-closed.
 *
 * A rota W6 POST /events/:eventId/rfqs/:rfqId/quotes/:quoteId/accept era MONEY-ADJACENT: confiava em
 * actionContext.actorId como autoridade e materializava availability → booking → service_booking_decision →
 * service_payment_request PENDING "em nome do provider", sem canRepresentActor, sem confirmação do provider.
 * P0: a rota responde 403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED ANTES de qualquer sink material.
 *
 *   A organizer legítimo (Alice) accept → 403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED (contido mesmo p/ organizer)
 *   B spoof (Bob declara organizer de Alice) accept → 403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED
 *   C events.metadata inalterado (RFQ segue open, quote NÃO marcada accepted)
 *   D availability count inalterado · E bookings count inalterado
 *   F service_booking_decisions count inalterado · G service_payment_requests count inalterado
 *   H bank_ledger/bank_transactions/bank_splits inalterados
 *   I guard R7b containment verde · J guard R7a actor-binding verde (W1-W5 não tocadas) · K baseline canal-1 verde
 *
 * 🔒 DB EFÊMERA (run-event-rfq-acceptquote-containment-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { eventRFQRoutes } from '../modules/events/event-rfq.routes';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const cwd = process.cwd();
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/event|rfq|accept|contain|binding|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq * 17).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId };
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Event RFQ AcceptQuote Containment', slug: `erfq-acc-${Date.now()}` });
  const alice = await mkUserActor(TENANT, 'Alice');   // organizer do evento
  const bob = await mkUserActor(TENANT, 'Bob');       // não representa Alice
  const provider = await mkUserActor(TENANT, 'Provider'); // provider da quote

  // Evento público+published de Alice, RFQ aberto com 1 quote do provider (cenário em que acceptQuote FARIA
  // trabalho material se executasse — assim a contenção é provada por ausência de side-effects).
  const RFQ_ID = randomUUID();
  const QUOTE_ID = randomUUID();
  const SERVICE_ID = randomUUID();
  const seededRfq = {
    rfqId: RFQ_ID, eventId: '', tenantId: TENANT, organizerActorId: alice.actorId,
    items: [], criteria: {}, status: 'open',
    quotes: [{
      quoteId: QUOTE_ID, rfqId: RFQ_ID, providerActorId: provider.actorId,
      serviceId: SERVICE_ID, priceCents: 50000, currency: 'BRL',
      accepted: false, createdAt: '2026-06-18T00:00:00.000Z',
    }],
    createdAt: '2026-06-18T00:00:00.000Z', updatedAt: '2026-06-18T00:00:00.000Z', closedAt: null,
  };
  const eventId = (await pool.query<{ id: string }>(
    `INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title, status, visibility, metadata)
       VALUES ($1::uuid,$2::uuid,'user','general','E2E RFQ Accept','published','public', $3::jsonb) RETURNING id::text AS id`,
    [TENANT, alice.actorId, JSON.stringify({ rfqs: [{ ...seededRfq }] })]
  )).rows[0].id;
  await pool.query(`UPDATE events SET metadata = $2::jsonb WHERE id = $1`, [eventId, JSON.stringify({ rfqs: [{ ...seededRfq, eventId }] })]);

  const snapshotMetadata = async (): Promise<string> => JSON.stringify((await pool.query<{ metadata: any }>(`SELECT metadata FROM events WHERE id=$1`, [eventId])).rows[0]?.metadata);
  const availCount = (): Promise<number> => count(`SELECT count(*)::int AS n FROM availability`);
  const bookingCount = (): Promise<number> => count(`SELECT count(*)::int AS n FROM bookings`);
  const decisionCount = (): Promise<number> => count(`SELECT count(*)::int AS n FROM service_booking_decisions`);
  const paymentReqCount = (): Promise<number> => count(`SELECT count(*)::int AS n FROM service_payment_requests`);
  const bankCount = (): Promise<number> => count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits))::int AS n`);

  const mdBefore = await snapshotMetadata();
  const availBefore = await availCount();
  const bookingBefore = await bookingCount();
  const decisionBefore = await decisionCount();
  const payBefore = await paymentReqCount();
  const bankBefore = await bankCount();

  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    req.user = { userId: req.headers['x-test-user-id'], id: req.headers['x-test-user-id'] };
    req.tenant = { id: TENANT };
    req.actionContext = { actorId: req.headers['x-test-actor-id'] || req.headers['x-test-user-id'], intent: 'e2e', source: 'e2e', scope: 'e2e' };
  });
  await app.register(eventRFQRoutes);
  await app.ready();

  const post = (url: string, userId: string, actorId: string, body: unknown = {}) => app.inject({
    method: 'POST', url, headers: { 'x-test-user-id': userId, 'x-test-actor-id': actorId, 'content-type': 'application/json' }, payload: JSON.stringify(body),
  });
  const acceptUrl = `/events/${eventId}/rfqs/${RFQ_ID}/quotes/${QUOTE_ID}/accept`;
  const isContained = (r: { statusCode: number; body: string }): boolean => {
    if (r.statusCode !== 403) return false;
    try { return JSON.parse(r.body)?.code === 'EVENT_RFQ_ACCEPT_QUOTE_CONTAINED'; } catch { return false; }
  };

  try {
    console.log('\n— W6 acceptQuote CONTENÇÃO —');
    // A organizer legítimo também é contido (P0 = ninguém aceita até o fluxo de confirmação do provider existir).
    const a = await post(acceptUrl, alice.userId, alice.actorId);
    record('A organizer legítimo (Alice) accept → 403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED', isContained(a), `status=${a.statusCode}: ${a.body.slice(0,140)}`);
    // B spoof também contido (fail-closed independe de representação — nada material roda).
    const b = await post(acceptUrl, bob.userId, alice.actorId);
    record('B spoof (Bob declara organizer de Alice) accept → 403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED', isContained(b), `status=${b.statusCode}: ${b.body.slice(0,140)}`);

    console.log('\n— Zero write material (após 2 chamadas) —');
    record('C events.metadata inalterado (RFQ open, quote NÃO accepted)', (await snapshotMetadata()) === mdBefore);
    record('D availability count inalterado', (await availCount()) === availBefore, `before=${availBefore} after=${await availCount()}`);
    record('E bookings count inalterado', (await bookingCount()) === bookingBefore, `before=${bookingBefore} after=${await bookingCount()}`);
    record('F service_booking_decisions count inalterado', (await decisionCount()) === decisionBefore, `before=${decisionBefore} after=${await decisionCount()}`);
    record('G service_payment_requests count inalterado', (await paymentReqCount()) === payBefore, `before=${payBefore} after=${await paymentReqCount()}`);
    record('H bank_ledger+transactions+splits inalterados', (await bankCount()) === bankBefore, `before=${bankBefore} after=${await bankCount()}`);

    console.log('\n— Guards (W6 contido + R7a/baseline intactos) —');
    let gR7b = 0; try { execSync('node scripts/audit-event-rfq-acceptquote-containment.mjs', { cwd, encoding: 'utf8' }); } catch { gR7b = 1; }
    record('I guard R7b containment verde (hard-stop antes do sink)', gR7b === 0);
    let gR7a = 0; try { execSync('node scripts/audit-event-rfq-actor-binding.mjs', { cwd, encoding: 'utf8' }); } catch { gR7a = 1; }
    record('J guard R7a actor-binding verde (W1-W5 não tocadas)', gR7a === 0);
    let gBaseline = 0; try { execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' }); } catch { gBaseline = 1; }
    record('K baseline canal-1 verde (event-rfq mantido)', gBaseline === 0);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ W6 acceptQuote CONTIDO fail-closed (403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED) antes de qualquer sink; zero write material; Bank intocado; R7a/baseline intactos.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
