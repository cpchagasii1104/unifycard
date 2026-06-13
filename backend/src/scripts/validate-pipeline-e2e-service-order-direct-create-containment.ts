/**
 * E2E F-SERVICE-ORDER-DIRECT-CREATE-AUTHORITY-CONTAINMENT.
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-service-order-direct-create-containment-ephemeral.ps1.
 *
 * Prova que POST /service-orders (criação DIRETA) está CONTIDA fail-closed (403
 * SERVICE_ORDER_DIRECT_CREATE_DISABLED) ANTES de serviceOrderService.createOrder, sem quebrar o
 * fluxo canônico booking→decision→confirmBookingFromDecision→order. Bank/dispute intocados.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { serviceBookingDecisionService } from '../modules/services/service-booking-decision.service';
import { serviceOrderService } from '../modules/services/service-order.service';
import { BookingDecisionStatus } from '../modules/services/service-booking-decision.types';
import serviceOrderRoutes from '../modules/services/service-order.routes';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — esta validação NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/service|order|direct|containment|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
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
  return (await pool.query<{ id: string }>(`INSERT INTO availability (tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone, capacity, metadata) VALUES ($1::uuid,'user',$2::uuid,'fixed','active',$3,$4,'America/Sao_Paulo',1,'{}'::jsonb) RETURNING availability_id::text AS id`, [tenantId, ownerActorId, new Date('2026-09-01T09:00:00Z'), new Date('2026-09-01T10:00:00Z')])).rows[0].id;
}
async function mkBooking(tenantId: string, availabilityId: string, requesterActorId: string, serviceId: string): Promise<string> {
  return (await pool.query<{ id: string }>(`INSERT INTO bookings (tenant_id, availability_id, requester_actor_id, status, metadata, requested_at, created_at, updated_at) VALUES ($1::uuid,$2::uuid,$3::uuid,'requested',$4::jsonb,NOW(),NOW(),NOW()) RETURNING booking_id::text AS id`, [tenantId, availabilityId, requesterActorId, JSON.stringify({ serviceId })])).rows[0].id;
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

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'SO Direct Containment', slug: `sodc-${Date.now()}` });

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  // App mínima registrando as rotas reais de service-order; injeta sem auth (a rota contida
  // retorna 403 incondicional, antes de tocar tenant/actionContext/createOrder).
  const app = Fastify();
  app.decorateRequest('tenant', null);
  app.decorateRequest('user', null);
  app.decorateRequest('actionContext', null);
  await app.register(serviceOrderRoutes);
  await app.ready();

  // ── T1 — POST /service-orders com campos cliente-declarados → 403 SERVICE_ORDER_DIRECT_CREATE_DISABLED ──
  {
    const res = await app.inject({
      method: 'POST', url: '/service-orders',
      payload: { serviceId: randomUUID(), workerActorId: randomUUID(), customerActorId: randomUUID(), bookingId: randomUUID(), scheduledStart: '2026-09-01T09:00:00Z' },
    });
    let code: string | undefined;
    try { code = JSON.parse(res.body)?.code; } catch { /* noop */ }
    record('T1 POST /service-orders → 403 SERVICE_ORDER_DIRECT_CREATE_DISABLED', res.statusCode === 403 && code === 'SERVICE_ORDER_DIRECT_CREATE_DISABLED', `status=${res.statusCode} code=${code}`);
  }

  // ── T2 — bookingId inexistente NÃO vira 404/validação (service não foi chamado: segue 403) ──
  {
    const res = await app.inject({
      method: 'POST', url: '/service-orders',
      payload: { serviceId: randomUUID(), workerActorId: randomUUID(), customerActorId: randomUUID(), bookingId: '00000000-0000-0000-0000-000000000000' },
    });
    record('T2 bookingId inexistente → 403 (não 404/validação: createOrder não alcançado)', res.statusCode === 403, `status=${res.statusCode}`);
  }

  // ── T3 — zero linha em service_orders após as chamadas bloqueadas ──
  record('T3 zero service_order criada pela rota direta bloqueada', (await count(`SELECT count(*)::int AS n FROM service_orders`)) === 0);

  await app.close();

  // ── T4/T5 — fluxo canônico booking→decision→confirmBookingFromDecision intacto ──
  const alice = await mkUserActor(TENANT_ID, 'Alice');
  const carol = await mkUserActor(TENANT_ID, 'Carol');
  const serviceA = await mkService(TENANT_ID, alice.actorId, 'ServicoA');
  const availability = await mkAvailability(TENANT_ID, alice.actorId);
  const booking = await mkBooking(TENANT_ID, availability, carol.actorId, serviceA);

  let orderId: string | null = null;
  {
    let ok = false; let reason = '';
    try {
      const decision = await serviceBookingDecisionService.createDecision(TENANT_ID, alice.userId, {
        bookingId: booking, decidedByActorId: alice.actorId, status: BookingDecisionStatus.ACCEPTED,
      });
      const order = await serviceOrderService.confirmBookingFromDecision(TENANT_ID, booking, decision.decisionId, alice.actorId, alice.userId);
      orderId = order.id;
      ok = order.workerActorId === alice.actorId;
      reason = `worker=${order.workerActorId}`;
    } catch (e) { reason = e instanceof Error ? e.message : String(e); }
    record('T4 fluxo canônico confirmBookingFromDecision intacto (order; worker=dono)', ok, reason);
  }
  {
    let blocked = false;
    try {
      const d = (await pool.query<{ d: string }>(`SELECT decision_id::text AS d FROM service_booking_decisions WHERE booking_id=$1`, [booking])).rows[0].d;
      await serviceOrderService.confirmBookingFromDecision(TENANT_ID, booking, d, alice.actorId, alice.userId);
    } catch { blocked = true; }
    record('T5 duplicidade do caminho canônico segue bloqueada', blocked);
  }

  // ── T6 — Bank intocado ──
  record('T6 Bank intocado (bank_ledger + bank_transactions inalterados)', (await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)) === bankBefore);

  // ── T7 — dispute/reversal containment intactos (estrutural) ──
  {
    const disputeSrc = readFileSync(join(process.cwd(), 'src/modules/reconciliation/reconciliation-dispute.routes.ts'), 'utf-8');
    const reversal = disputeSrc.includes('DISPUTE_REVERSAL_HTTP_DISABLED');
    const mutation = disputeSrc.includes('DISPUTE_MUTATION_HTTP_DISABLED');
    record('T7 dispute/reversal containment intactos (403 codes preservados)', reversal && mutation);
  }

  // ── S — exatamente 1 service_order (a do caminho canônico) ──
  record('S exatamente 1 service_order (caminho canônico), nenhuma da rota direta', (await count(`SELECT count(*)::int AS n FROM service_orders`)) === 1, `orderId=${orderId}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ POST /service-orders contido (403 antes de createOrder); fluxo canônico e Bank/dispute intactos.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
