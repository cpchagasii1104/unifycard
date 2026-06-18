/**
 * E2E — R7a EVENT-RFQ ACTING-USER-GATE (DECISION-0113 / DECISION-0131 §B7 / Z2). NÃO MOVE DINHEIRO.
 *
 * Prova que as ESCRITAS RFQ non-money-runtime W1-W5 deixam de confiar em actionContext.actorId /
 * actionContext.actingUserId como autoridade e exigem subject server-side (req.user.userId) + representação
 * ANTES do write:
 *   - W1 createRFQ / W3 createQuote: canRepresentActor(req.user.userId, actorId declarado) [target/hint].
 *   - W2 close / W4 from-spec / W5 dispatch: assertCanReadEventMoney (organizer server-resolved de event.actor_id).
 * W6 acceptQuote (money-adjacent) é FORA do escopo — provado intocado pelo guard.
 *
 *   A W1 spoof → 403 + zero RFQ nova · B W1 legit → passa do gate (≠403)
 *   C W3 spoof → 403 + zero quote · D W3 legit → passa do gate
 *   E W2 spoof → 403 + status RFQ inalterado · F W2 legit → fecha (CLOSED)
 *   G W4 spoof → 403 · H W5 spoof → 403
 *   I leituras RFQ seguem BOUND (assertCanReadEventMoney): spoof 403 / organizer 200
 *   J acceptQuote NÃO tocado (guard W6) · K Bank intocado · L regressão R6.2/R6.1/referral
 *
 * 🔒 DB EFÊMERA (run-event-rfq-actor-binding-ephemeral.ps1). NUNCA toca unificard_dev.
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
  if (!/event|rfq|binding|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
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
  await tenantService.createTenant({ id: TENANT, name: 'Event RFQ Binding', slug: `erfq-${Date.now()}` });
  const alice = await mkUserActor(TENANT, 'Alice'); // organizer do evento
  const bob = await mkUserActor(TENANT, 'Bob');     // não representa Alice

  // Evento público+published de Alice (público → Bob VÊ → spoof cai no 403 de representação, não 404).
  const RFQ_ID = randomUUID();
  const seededRfq = {
    rfqId: RFQ_ID, eventId: '', tenantId: TENANT, organizerActorId: alice.actorId,
    items: [], criteria: {}, status: 'open', quotes: [],
    createdAt: '2026-06-18T00:00:00.000Z', updatedAt: '2026-06-18T00:00:00.000Z', closedAt: null,
  };
  const eventId = (await pool.query<{ id: string }>(
    `INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title, status, visibility, metadata)
       VALUES ($1::uuid,$2::uuid,'user','general','E2E RFQ','published','public', $3::jsonb) RETURNING id::text AS id`,
    [TENANT, alice.actorId, JSON.stringify({ rfqs: [{ ...seededRfq }] })]
  )).rows[0].id;
  // fixar eventId dentro do rfq semeado.
  await pool.query(`UPDATE events SET metadata = $2::jsonb WHERE id = $1`, [eventId, JSON.stringify({ rfqs: [{ ...seededRfq, eventId }] })]);

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits))::int AS n`);

  const rfqCount = async (): Promise<number> => {
    const md = (await pool.query<{ metadata: any }>(`SELECT metadata FROM events WHERE id=$1`, [eventId])).rows[0]?.metadata;
    return Array.isArray(md?.rfqs) ? md.rfqs.length : 0;
  };
  const rfqStatus = async (rid: string): Promise<string | null> => {
    const md = (await pool.query<{ metadata: any }>(`SELECT metadata FROM events WHERE id=$1`, [eventId])).rows[0]?.metadata;
    const r = (md?.rfqs ?? []).find((x: any) => x.rfqId === rid);
    return r?.status ?? null;
  };
  const quoteCount = async (rid: string): Promise<number> => {
    const md = (await pool.query<{ metadata: any }>(`SELECT metadata FROM events WHERE id=$1`, [eventId])).rows[0]?.metadata;
    const r = (md?.rfqs ?? []).find((x: any) => x.rfqId === rid);
    return Array.isArray(r?.quotes) ? r.quotes.length : 0;
  };

  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    req.user = { userId: req.headers['x-test-user-id'], id: req.headers['x-test-user-id'] };
    req.tenant = { id: TENANT };
    // actionContext.actorId = ALVO DECLARADO (spoofável) — header próprio; subject vem de req.user.
    req.actionContext = { actorId: req.headers['x-test-actor-id'] || req.headers['x-test-user-id'], intent: 'e2e', source: 'e2e', scope: 'e2e' };
  });
  await app.register(eventRFQRoutes);
  await app.ready();

  // helpers de inject (userId = subject; actorId = alvo declarado).
  const post = (url: string, userId: string, actorId: string, body: unknown = {}) => app.inject({
    method: 'POST', url, headers: { 'x-test-user-id': userId, 'x-test-actor-id': actorId, 'content-type': 'application/json' }, payload: JSON.stringify(body),
  });
  const get = (url: string, userId: string) => app.inject({ method: 'GET', url, headers: { 'x-test-user-id': userId, 'x-test-actor-id': alice.actorId } });

  try {
    // ── W1 createRFQ ──
    console.log('\n— W1 createRFQ —');
    const beforeW1 = await rfqCount();
    const a = await post(`/events/${eventId}/rfqs`, bob.userId, alice.actorId, { items: [], criteria: {} });
    record('A W1 spoof (Bob declara organizer de Alice) → 403', a.statusCode === 403, `status=${a.statusCode}: ${a.body.slice(0,100)}`);
    record('A2 W1 spoof → zero RFQ nova (metadata.rfqs inalterado)', (await rfqCount()) === beforeW1, `before=${beforeW1} after=${await rfqCount()}`);
    const b = await post(`/events/${eventId}/rfqs`, alice.userId, alice.actorId, { items: [], criteria: {} });
    record('B W1 legit (Alice representa o organizer) → passa do gate (≠403)', b.statusCode !== 403, `status=${b.statusCode}`);

    // ── W3 createQuote (sobre o RFQ semeado) ──
    console.log('\n— W3 createQuote —');
    const beforeQ = await quoteCount(RFQ_ID);
    const c = await post(`/events/${eventId}/rfqs/${RFQ_ID}/quotes`, bob.userId, alice.actorId, { serviceId: randomUUID(), priceCents: 1000, currency: 'BRL' });
    record('C W3 spoof (Bob declara provider de Alice) → 403', c.statusCode === 403, `status=${c.statusCode}`);
    record('C2 W3 spoof → zero quote nova', (await quoteCount(RFQ_ID)) === beforeQ, `before=${beforeQ} after=${await quoteCount(RFQ_ID)}`);
    const d = await post(`/events/${eventId}/rfqs/${RFQ_ID}/quotes`, alice.userId, alice.actorId, { serviceId: randomUUID(), priceCents: 1000, currency: 'BRL' });
    record('D W3 legit (Alice representa o provider declarado) → passa do gate (≠403)', d.statusCode !== 403, `status=${d.statusCode}`);

    // ── W2 closeRFQ (organizer server-resolved) ──
    console.log('\n— W2 closeRFQ —');
    const e = await post(`/events/${eventId}/rfqs/${RFQ_ID}/close`, bob.userId, bob.actorId);
    record('E W2 spoof (Bob não representa organizer) → 403', e.statusCode === 403, `status=${e.statusCode}`);
    record('E2 W2 spoof → status RFQ inalterado (open)', (await rfqStatus(RFQ_ID)) === 'open', `status=${await rfqStatus(RFQ_ID)}`);
    const f = await post(`/events/${eventId}/rfqs/${RFQ_ID}/close`, alice.userId, alice.actorId);
    record('F W2 legit (Alice = organizer) → fecha RFQ (≠403)', f.statusCode !== 403, `status=${f.statusCode}`);
    record('F2 W2 legit → status RFQ = closed', (await rfqStatus(RFQ_ID)) === 'closed', `status=${await rfqStatus(RFQ_ID)}`);

    // ── W4 from-spec (gate antes de buscar spec) ──
    console.log('\n— W4 from-spec —');
    const g = await post(`/events/${eventId}/rfqs/from-spec/${randomUUID()}`, bob.userId, bob.actorId);
    record('G W4 spoof (Bob não representa organizer) → 403 (antes de tocar spec/declaration)', g.statusCode === 403, `status=${g.statusCode}`);

    // ── W5 dispatch (organizer server-resolved) ──
    console.log('\n— W5 dispatch —');
    const h = await post(`/events/${eventId}/rfqs/${RFQ_ID}/dispatch`, bob.userId, bob.actorId, { companyActorIds: [bob.actorId] });
    record('H W5 spoof (Bob não representa organizer) → 403 (zero dispatch)', h.statusCode === 403, `status=${h.statusCode}`);

    // ── I leituras seguem BOUND (assertCanReadEventMoney) ──
    console.log('\n— I leituras RFQ (não-regressão) —');
    const iBob = await get(`/events/${eventId}/rfqs`, bob.userId);
    record('I1 read spoof (Bob não representa organizer) → 403 (reads seguem BOUND)', iBob.statusCode === 403, `status=${iBob.statusCode}`);
    const iAlice = await get(`/events/${eventId}/rfqs`, alice.userId);
    record('I2 read organizer (Alice) → 200', iAlice.statusCode === 200, `status=${iAlice.statusCode}`);

    // ── K Bank intocado ──
    console.log('\n— K Bank intocado —');
    const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits))::int AS n`);
    record('K bank_ledger+transactions+splits inalterados', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

    // ── J/L guards (W6 não tocado + não-regressão) ──
    console.log('\n— J/L guards —');
    let gRfq = 0; try { execSync('node scripts/audit-event-rfq-actor-binding.mjs', { cwd, encoding: 'utf8' }); } catch { gRfq = 1; }
    record('J guard event-rfq verde (W1-W5 bound; W6 acceptQuote NÃO tocado)', gRfq === 0);
    let gBoundary = 0; try { execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' }); } catch { gBoundary = 1; }
    record('J2 baseline canal-1 verde (event-rfq mantido — W6 não mascarado)', gBoundary === 0);
    let r62 = 0; try { execSync('node scripts/audit-social-posts-actor-binding.mjs', { cwd, encoding: 'utf8' }); } catch { r62 = 1; }
    record('L1 guard R6.2 social-posts verde', r62 === 0);
    let r61 = 0; try { execSync('node scripts/audit-services-actor-binding.mjs', { cwd, encoding: 'utf8' }); } catch { r61 = 1; }
    record('L2 guard R6.1 services verde', r61 === 0);
    let rRef = 0; try { execSync('node scripts/audit-referral-register-actor-code-gate.mjs', { cwd, encoding: 'utf8' }); } catch { rRef = 1; }
    record('L3 guard referral actor-code verde', rRef === 0);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ W1-W5 RFQ vinculam autoridade ao subject server-side (req.user.userId) + representação; spoof fail-closed 403; W6 acceptQuote intocado; Bank intocado.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
