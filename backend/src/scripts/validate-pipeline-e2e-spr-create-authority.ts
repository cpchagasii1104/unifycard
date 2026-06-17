/**
 * E2E — F-C1-MONEY-SPR-CREATE-AUTHORITY-HARDENING (DECISION-0113 · decisão de produto Opção A). ZERO dinheiro.
 *
 * Opção A: a COBRANÇA (payment_request) é EMITIDA pelo RECEIVER/PROVIDER (dono do service). O emissor deve
 * REPRESENTAR o receiver_actor_id (= service.actor_id, derivado server-side). payer = booking.requester
 * (derivado). body/actionContext NÃO provam autoridade nem definem as partes.
 *
 *   POST /:serviceId/bookings/:bookingId/payments
 *   T1 receiver (Bob, dono do service) cria → 201; PR.payer/receiver = DERIVADOS (alice/bob)
 *   T2 payer (Alice) NÃO cria → 403 · T3 terceiro (Carol) → 403 · T4 spoof actionContext → 403
 *   T5 spoof body.payerActorId → ignorado (PR.payer = derivado) · T6 spoof body.receiverActorId → ignorado
 *   T7 booking de outro service → falha (400) · T8 booking não-aceito → falha (400)
 *   T9 zero service_payment_executions · T10 Bank/ledger/split intocados
 *
 * 🔒 DB EFÊMERA (run-spr-create-authority-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import servicePaymentRequestRoutes from '../modules/services/service-payment-request.routes';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/spr|payment|authority|service|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@e2e.test`]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId };
}
async function mkService(tenantId: string, ownerActorId: string, name: string): Promise<string> {
  seq += 1;
  return (await pool.query<{ id: string }>(`INSERT INTO services (tenant_id, actor_id, name, slug, service_type, status, currency) VALUES ($1::uuid,$2::uuid,$3,$4,'service','active','BRL') RETURNING service_id::text AS id`, [tenantId, ownerActorId, name, `${name.toLowerCase()}-${seq}`])).rows[0].id;
}
async function mkAvailability(tenantId: string, ownerActorId: string): Promise<string> {
  return (await pool.query<{ id: string }>(`INSERT INTO availability (tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone, capacity, metadata) VALUES ($1::uuid,'user',$2::uuid,'fixed','active',$3,$4,'America/Sao_Paulo',1,'{}'::jsonb) RETURNING availability_id::text AS id`, [tenantId, ownerActorId, new Date('2026-08-01T09:00:00Z'), new Date('2026-08-01T10:00:00Z')])).rows[0].id;
}
async function mkBooking(tenantId: string, availabilityId: string, requesterActorId: string, serviceId: string): Promise<string> {
  return (await pool.query<{ id: string }>(`INSERT INTO bookings (tenant_id, availability_id, requester_actor_id, status, metadata, requested_at, created_at, updated_at) VALUES ($1::uuid,$2::uuid,$3::uuid,'requested',$4::jsonb,NOW(),NOW(),NOW()) RETURNING booking_id::text AS id`, [tenantId, availabilityId, requesterActorId, JSON.stringify({ serviceId })])).rows[0].id;
}
async function mkDecisionAccepted(tenantId: string, bookingId: string, deciderActorId: string): Promise<void> {
  await pool.query(`INSERT INTO service_booking_decisions (tenant_id, booking_id, decided_by_actor_id, status, decided_at, metadata, created_at, updated_at) VALUES ($1::uuid,$2::uuid,$3::uuid,'accepted',NOW(),'{}'::jsonb,NOW(),NOW())`, [tenantId, bookingId, deciderActorId]);
}

let CURRENT_USER = ''; let CURRENT_AC = '';

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
  await tenantService.createTenant({ id: TENANT, name: 'SPR Create Authority', slug: `sprc-${Date.now()}` });
  const alice = await mkUserActor(TENANT, 'Alice'); // payer (requester)
  const bob = await mkUserActor(TENANT, 'Bob');     // receiver (dono do service)
  const carol = await mkUserActor(TENANT, 'Carol'); // terceiro

  const service = await mkService(TENANT, bob.actorId, 'Corte');     // dono = Bob
  const service2 = await mkService(TENANT, bob.actorId, 'Barba');    // outro service (também Bob)
  const avail = await mkAvailability(TENANT, bob.actorId);

  // bookings aceitos (decididos por Bob) p/ os casos que criam; booking sem decisão p/ T8.
  const bMain = await mkBooking(TENANT, avail, alice.actorId, service); await mkDecisionAccepted(TENANT, bMain, bob.actorId);
  const b5 = await mkBooking(TENANT, avail, alice.actorId, service); await mkDecisionAccepted(TENANT, b5, bob.actorId);
  const b6 = await mkBooking(TENANT, avail, alice.actorId, service); await mkDecisionAccepted(TENANT, b6, bob.actorId);
  const b7 = await mkBooking(TENANT, avail, alice.actorId, service); await mkDecisionAccepted(TENANT, b7, bob.actorId); // pertence a `service`
  const b8 = await mkBooking(TENANT, avail, alice.actorId, service); // SEM decisão

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
  const splitsBefore = await count(`SELECT count(*)::int AS n FROM bank_splits`);

  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    req.user = { id: CURRENT_USER, userId: CURRENT_USER };
    req.tenant = { id: TENANT };
    req.actionContext = { actorId: CURRENT_AC, scope: 'tenant', intent: 'write' };
  });
  await app.register(servicePaymentRequestRoutes);
  await app.ready();

  const post = (svc: string, bk: string, body: Record<string, unknown>) => app.inject({
    method: 'POST', url: `/${svc}/bookings/${bk}/payments`, headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ amountCents: 1000, currency: 'BRL', ...body }),
  });
  const prRow = async (bk: string) => (await pool.query<{ payer: string; receiver: string }>(`SELECT payer_actor_id::text payer, receiver_actor_id::text receiver FROM service_payment_requests WHERE tenant_id=$1 AND booking_id=$2 LIMIT 1`, [TENANT, bk])).rows[0];

  try {
    // T1 — receiver Bob cria → 201; payer/receiver DERIVADOS.
    CURRENT_USER = bob.userId; CURRENT_AC = bob.actorId;
    const r1 = await post(service, bMain, {});
    const row1 = await prRow(bMain);
    record('T1 receiver (Bob) cria a cobrança → 201; payer=Alice receiver=Bob (derivados)', r1.statusCode === 201 && row1?.payer === alice.actorId && row1?.receiver === bob.actorId, `status=${r1.statusCode} payer=${row1?.payer} receiver=${row1?.receiver}`);

    // T2 — payer Alice NÃO cria → 403.
    CURRENT_USER = alice.userId; CURRENT_AC = alice.actorId;
    const r2 = await post(service, b5, {});
    const b2body = (() => { try { return JSON.parse(r2.body); } catch { return null; } })();
    record('T2 payer (Alice) NÃO cria a cobrança → 403', r2.statusCode === 403 && /receiver\/provider/i.test(b2body?.error || ''), `status=${r2.statusCode} err=${b2body?.error}`);

    // T3 — terceiro Carol → 403.
    CURRENT_USER = carol.userId; CURRENT_AC = carol.actorId;
    const r3 = await post(service, b5, {});
    record('T3 terceiro (Carol) → 403', r3.statusCode === 403, `status=${r3.statusCode}`);

    // T4 — spoof actionContext: Carol declara o actor de Bob → 403 (req.user=Carol não representa Bob).
    CURRENT_USER = carol.userId; CURRENT_AC = bob.actorId;
    const r4 = await post(service, b5, {});
    record('T4 spoof actionContext.actorId (Carol declara actor de Bob) → 403', r4.statusCode === 403, `status=${r4.statusCode}`);

    // T5 — Bob cria com body.payerActorId spoofado (Carol) → 201; PR.payer = DERIVADO (Alice).
    CURRENT_USER = bob.userId; CURRENT_AC = bob.actorId;
    const r5 = await post(service, b5, { payerActorId: carol.actorId });
    const row5 = await prRow(b5);
    record('T5 spoof body.payerActorId (Carol) → ignorado; PR.payer = Alice (derivado)', r5.statusCode === 201 && row5?.payer === alice.actorId, `status=${r5.statusCode} payer=${row5?.payer}`);

    // T6 — Bob cria com body.receiverActorId spoofado (Carol) → 201; PR.receiver = DERIVADO (Bob).
    CURRENT_USER = bob.userId; CURRENT_AC = bob.actorId;
    const r6 = await post(service, b6, { receiverActorId: carol.actorId });
    const row6 = await prRow(b6);
    record('T6 spoof body.receiverActorId (Carol) → ignorado; PR.receiver = Bob (derivado)', r6.statusCode === 201 && row6?.receiver === bob.actorId, `status=${r6.statusCode} receiver=${row6?.receiver}`);

    // T7 — booking de OUTRO service (b7 pertence a `service`, POST contra service2) → 400.
    CURRENT_USER = bob.userId; CURRENT_AC = bob.actorId;
    const r7 = await post(service2, b7, {});
    record('T7 booking de outro service → falha (≠201)', r7.statusCode !== 201, `status=${r7.statusCode}`);

    // T8 — booking não-aceito (sem decisão) → 400.
    CURRENT_USER = bob.userId; CURRENT_AC = bob.actorId;
    const r8 = await post(service, b8, {});
    record('T8 booking não-aceito (sem decisão accepted) → falha (≠201)', r8.statusCode !== 201, `status=${r8.statusCode}`);

    // T9 — nenhuma execução financeira criada.
    record('T9 zero service_payment_executions', (await count(`SELECT count(*)::int AS n FROM service_payment_executions`)) === 0);

    // T10 — Bank/ledger/split intocados.
    const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
    const splitsAfter = await count(`SELECT count(*)::int AS n FROM bank_splits`);
    record('T10 Bank/ledger/split intocados', bankAfter === bankBefore && splitsAfter === splitsBefore);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ A cobrança é emitida pelo RECEIVER/PROVIDER (representa service.actor_id); payer/receiver derivados server-side; body/actionContext não autorizam; zero dinheiro.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
