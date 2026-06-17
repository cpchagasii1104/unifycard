/**
 * E2E — F-C1-MONEY-SPR-READ-AUTHORITY-HARDENING (DECISION-0113). NÃO MOVE DINHEIRO.
 *
 * Prova que a LEITURA de service-payment-request exige autoridade server-side: o chamador
 * (req.user) deve REPRESENTAR o payer OU o receiver da relação financeira. tenant_id não basta;
 * actionContext.actorId spoofado não autoriza.
 *
 *   GET /:serviceId/bookings/:bookingId/payments
 *   GET /payments/:paymentRequestId/execution  (mesma cadeia; firewall só no POST execute)
 *
 *   T1 payer (Alice) lê → 200 · T2 receiver (Bob) lê → 200 · T3 terceiro do mesmo tenant (Carol) → 403
 *   T4 spoof actionContext.actorId (Carol declara o actor de Alice) → 403 · T5 tenant certo sem ownership → 403
 *   T6 nenhuma escrita financeira (service_payment_executions=0) · T7 Bank/ledger/split intocados
 *   T8 execution: payer passa o binding (≠403; 404 sem execução) · T9 terceiro → 403 · T10 spoof → 403
 *
 * 🔒 DB EFÊMERA (run-spr-read-authority-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import servicePaymentRequestRoutes from '../modules/services/service-payment-request.routes';
import servicePaymentExecutionRoutes from '../modules/services/service-payment-execution.routes';
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
async function mkPaymentRequest(tenantId: string, bookingId: string, serviceId: string, payerActorId: string, receiverActorId: string): Promise<string> {
  const id = randomUUID();
  await pool.query(`INSERT INTO service_payment_requests (payment_request_id, tenant_id, booking_id, service_id, payer_actor_id, receiver_actor_id, payment_request_status, amount_cents, currency, requested_at, metadata, created_at, updated_at) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,'pending',1000,'BRL',NOW(),'{}'::jsonb,NOW(),NOW())`, [id, tenantId, bookingId, serviceId, payerActorId, receiverActorId]);
  return id;
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
  await tenantService.createTenant({ id: TENANT, name: 'SPR Read Authority', slug: `spr-${Date.now()}` });
  const alice = await mkUserActor(TENANT, 'Alice'); // payer (requester do booking)
  const bob = await mkUserActor(TENANT, 'Bob');     // receiver (dono do service)
  const carol = await mkUserActor(TENANT, 'Carol'); // terceiro do mesmo tenant

  const service = await mkService(TENANT, bob.actorId, 'Corte');
  const avail = await mkAvailability(TENANT, bob.actorId);
  const booking = await mkBooking(TENANT, avail, alice.actorId, service);
  const prId = await mkPaymentRequest(TENANT, booking, service, alice.actorId, bob.actorId);

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
  const splitsBefore = await count(`SELECT count(*)::int AS n FROM bank_splits`);

  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    req.user = { id: CURRENT_USER, userId: CURRENT_USER };
    req.tenant = { id: TENANT };
    req.actionContext = { actorId: CURRENT_AC, scope: 'tenant', intent: 'read' };
  });
  await app.register(servicePaymentRequestRoutes);
  await app.register(servicePaymentExecutionRoutes, { prefix: '/payments' });
  await app.ready();

  const getSpr = () => app.inject({ method: 'GET', url: `/${service}/bookings/${booking}/payments` });
  const getExec = () => app.inject({ method: 'GET', url: `/payments/${prId}/execution` });
  const is403 = (r: any) => r.statusCode === 403;

  try {
    // T1 — payer (Alice) representa o payer → 200.
    CURRENT_USER = alice.userId; CURRENT_AC = alice.actorId;
    const r1 = await getSpr();
    record('T1 payer (Alice) lê o próprio payment request → 200', r1.statusCode === 200, `status=${r1.statusCode}`);

    // T2 — receiver (Bob, dono do service) → 200.
    CURRENT_USER = bob.userId; CURRENT_AC = bob.actorId;
    const r2 = await getSpr();
    record('T2 receiver (Bob, dono do service) lê → 200', r2.statusCode === 200, `status=${r2.statusCode}`);

    // T3/T5 — terceiro do mesmo tenant (Carol), sem representar payer/receiver → 403 (tenant não basta).
    CURRENT_USER = carol.userId; CURRENT_AC = carol.actorId;
    const r3 = await getSpr();
    const b3 = (() => { try { return JSON.parse(r3.body); } catch { return null; } })();
    record('T3/T5 terceiro do mesmo tenant (Carol) sem ownership → 403 (tenant_id não basta)', is403(r3) && /represent the payer or receiver/i.test(b3?.error || ''), `status=${r3.statusCode} err=${b3?.error}`);

    // T4 — spoof: Carol declara o actor de Alice no actionContext → 403 (req.user=Carol não representa).
    CURRENT_USER = carol.userId; CURRENT_AC = alice.actorId;
    const r4 = await getSpr();
    record('T4 spoof actionContext.actorId (Carol declara actor de Alice) → 403', is403(r4), `status=${r4.statusCode}`);

    // T8 — execution: payer (Alice) passa o binding (≠403; 404 sem execução, sem dinheiro).
    CURRENT_USER = alice.userId; CURRENT_AC = alice.actorId;
    const r8 = await getExec();
    record('T8 execution GET: payer passa o binding → ≠403 (404 sem execução)', !is403(r8), `status=${r8.statusCode}`);

    // T9 — execution: terceiro (Carol) → 403.
    CURRENT_USER = carol.userId; CURRENT_AC = carol.actorId;
    const r9 = await getExec();
    record('T9 execution GET: terceiro sem ownership → 403', is403(r9), `status=${r9.statusCode}`);

    // T10 — execution: spoof → 403.
    CURRENT_USER = carol.userId; CURRENT_AC = alice.actorId;
    const r10 = await getExec();
    record('T10 execution GET: spoof actionContext → 403', is403(r10), `status=${r10.statusCode}`);

    // T6 — nenhuma escrita financeira (zero executions criadas).
    record('T6 nenhuma escrita financeira (service_payment_executions=0)', (await count(`SELECT count(*)::int AS n FROM service_payment_executions`)) === 0);

    // T7 — Bank/ledger/split intocados.
    const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
    const splitsAfter = await count(`SELECT count(*)::int AS n FROM bank_splits`);
    record('T7 Bank/ledger/split intocados', bankAfter === bankBefore && splitsAfter === splitsBefore);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ Leitura de service-payment-request exige representar payer OU receiver (server-side); tenant/actionContext não autorizam; zero dinheiro.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
