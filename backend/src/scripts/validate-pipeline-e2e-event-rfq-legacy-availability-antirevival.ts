/**
 * E2E — F-EVENT-RFQ-LEGACY-SERVICE-AVAILABILITY-ANTI-REACTIVATION-GUARD
 *   (DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT / DECISION-0156).
 * NÃO MOVE DINHEIRO. NÃO reativa/re-keya RFQ — apenas prova que o writer legado owner_type='service'
 * do fluxo rfq_accept está MORTO e congelado (lente SSOT temporal, complementar ao freezer R7b).
 *
 * SSOT: unified_availability/bookings com owner_type='service_offering' é o owner canônico da disponibilidade
 * reservável de serviço; owner_type='service' é legado/compatibilidade. O writer legado eventRFQService.acceptQuote
 * (availability owner_type='service' source:'rfq_accept' → booking → decision ACCEPTED → payment_request PENDING)
 * é o resíduo único da DT-mãe — contido pelo hard-stop 403 da rota W6.
 *
 *   A organizer legítimo (Alice) POST accept → 403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED
 *   B spoof (Bob declara organizer de Alice) POST accept → 403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED
 *   C events.metadata inalterado (RFQ segue open — acceptQuote NÃO foi chamado pela rota)
 *   D zero availability owner_type='service' nasce (writer legado morto)
 *   E zero availability com provenance rfq_accept nasce
 *   F zero booking nasce · G zero decision ACCEPTED nasce · H zero payment_request nasce
 *   I Δbank=0 (bank_ledger+bank_transactions+bank_splits inalterados)
 *   J guard dedicado anti-reativação verde · K freezer R7b verde (complementaridade intacta)
 *
 * 🔒 DB EFÊMERA (run-event-rfq-legacy-availability-antirevival-ephemeral.ps1). NUNCA toca unificard_dev.
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
  if (!/event|rfq|accept|contain|binding|ephemeral|test|guard/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
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
  await tenantService.createTenant({ id: TENANT, name: 'RFQ Legacy Availability Antirevival', slug: `erfq-antirevival-${Date.now()}` });
  const alice = await mkUserActor(TENANT, 'Alice');       // organizer do evento
  const bob = await mkUserActor(TENANT, 'Bob');           // não representa Alice
  const provider = await mkUserActor(TENANT, 'Provider'); // provider da quote

  // Evento público+published de Alice, RFQ aberto com 1 quote do provider — cenário em que o writer legado
  // FARIA trabalho material (availability owner_type='service' + booking + decision + payment_request) se
  // executasse. A anti-reativação é provada por 403 + ausência total de side-effects.
  const RFQ_ID = randomUUID();
  const QUOTE_ID = randomUUID();
  const SERVICE_ID = randomUUID();
  const seededRfq = {
    rfqId: RFQ_ID, eventId: '', tenantId: TENANT, organizerActorId: alice.actorId,
    items: [], criteria: {}, status: 'open',
    quotes: [{
      quoteId: QUOTE_ID, rfqId: RFQ_ID, providerActorId: provider.actorId,
      serviceId: SERVICE_ID, priceCents: 50000, currency: 'BRL',
      accepted: false, createdAt: '2026-07-01T00:00:00.000Z',
    }],
    createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z', closedAt: null,
  };
  const eventId = (await pool.query<{ id: string }>(
    `INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title, status, visibility, metadata)
       VALUES ($1::uuid,$2::uuid,'user','general','E2E RFQ Antirevival','published','public', $3::jsonb) RETURNING id::text AS id`,
    [TENANT, alice.actorId, JSON.stringify({ rfqs: [{ ...seededRfq }] })]
  )).rows[0].id;
  await pool.query(`UPDATE events SET metadata = $2::jsonb WHERE id = $1`, [eventId, JSON.stringify({ rfqs: [{ ...seededRfq, eventId }] })]);

  const snapshotMetadata = async (): Promise<string> => JSON.stringify((await pool.query<{ metadata: any }>(`SELECT metadata FROM events WHERE id=$1`, [eventId])).rows[0]?.metadata);
  const legacyAvailCount = (): Promise<number> => count(`SELECT count(*)::int AS n FROM availability WHERE owner_type='service'`);
  const rfqAcceptAvailCount = (): Promise<number> => count(`SELECT count(*)::int AS n FROM availability WHERE metadata->>'source'='rfq_accept'`);
  const bookingCount = (): Promise<number> => count(`SELECT count(*)::int AS n FROM bookings`);
  const acceptedDecisionCount = (): Promise<number> => count(`SELECT count(*)::int AS n FROM service_booking_decisions WHERE status='accepted'`);
  const paymentReqCount = (): Promise<number> => count(`SELECT count(*)::int AS n FROM service_payment_requests`);
  const bankCount = (): Promise<number> => count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits))::int AS n`);

  const mdBefore = await snapshotMetadata();
  const legacyBefore = await legacyAvailCount();
  const rfqAcceptBefore = await rfqAcceptAvailCount();
  const bookingBefore = await bookingCount();
  const decisionBefore = await acceptedDecisionCount();
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
    console.log('\n— Rota W6 accept CONTIDA (writer legado inalcançável) —');
    const a = await post(acceptUrl, alice.userId, alice.actorId);
    record('A organizer legítimo (Alice) accept → 403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED', isContained(a), `status=${a.statusCode}: ${a.body.slice(0, 140)}`);
    const b = await post(acceptUrl, bob.userId, alice.actorId);
    record('B spoof (Bob declara organizer de Alice) accept → 403 EVENT_RFQ_ACCEPT_QUOTE_CONTAINED', isContained(b), `status=${b.statusCode}: ${b.body.slice(0, 140)}`);

    console.log('\n— Zero write material do writer legado (após 2 chamadas) —');
    record('C events.metadata inalterado (RFQ open — acceptQuote NÃO chamado pela rota)', (await snapshotMetadata()) === mdBefore);
    record("D zero availability owner_type='service' nasce", (await legacyAvailCount()) === legacyBefore, `before=${legacyBefore} after=${await legacyAvailCount()}`);
    record("E zero availability com provenance source='rfq_accept' nasce", (await rfqAcceptAvailCount()) === rfqAcceptBefore, `before=${rfqAcceptBefore} after=${await rfqAcceptAvailCount()}`);
    record('F zero booking nasce', (await bookingCount()) === bookingBefore, `before=${bookingBefore} after=${await bookingCount()}`);
    record('G zero decision ACCEPTED nasce', (await acceptedDecisionCount()) === decisionBefore, `before=${decisionBefore} after=${await acceptedDecisionCount()}`);
    record('H zero payment_request nasce', (await paymentReqCount()) === payBefore, `before=${payBefore} after=${await paymentReqCount()}`);
    record('I Δbank=0 (bank_ledger+transactions+splits inalterados)', (await bankCount()) === bankBefore, `before=${bankBefore} after=${await bankCount()}`);

    console.log('\n— Guards (anti-reativação dedicado + freezer R7b) —');
    let gNew = 0; try { execSync('node scripts/audit-event-rfq-legacy-availability-antirevival-guard.mjs', { cwd, encoding: 'utf8' }); } catch { gNew = 1; }
    record('J guard anti-reativação dedicado verde (writer legado congelado)', gNew === 0);
    let gR7b = 0; try { execSync('node scripts/audit-event-rfq-acceptquote-containment.mjs', { cwd, encoding: 'utf8' }); } catch { gR7b = 1; }
    record('K freezer R7b verde (contenção da rota intacta)', gR7b === 0);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log("✨ Writer legado RFQ (availability owner_type='service' via rfq_accept) MORTO e congelado: 403 antes do sink; zero availability/booking/decision/payment_request; Δbank=0; guards dedicado+R7b verdes.");
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
