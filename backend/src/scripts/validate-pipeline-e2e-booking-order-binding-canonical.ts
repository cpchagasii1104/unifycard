/**
 * E2E F-BOOKING-ORDER-BINDING-CANONICAL.
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-booking-order-binding-canonical-ephemeral.ps1.
 *
 * Prova adversarial do fix do CONFUSED-DEPUTY booking -> decision -> service_order:
 * a AUTORIDADE de decidir/confirmar deriva do DONO SOBERANO da availability
 * (resolveAvailabilityOwner + canRepresentActor), NUNCA de booking.metadata.serviceId.
 * + integridade não-financeira (FK/UNIQUE) e Bank intocado.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { serviceBookingDecisionService } from '../modules/services/service-booking-decision.service';
import { serviceOrderService } from '../modules/services/service-order.service';
import { BookingDecisionStatus } from '../modules/services/service-booking-decision.types';
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
  if (!/booking|order|binding|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(
    `INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level)
       VALUES ($1::uuid,$2,'cpf','approved','basic')`,
    [gu, tax]
  );
  await pool.query(
    `INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, created_at, updated_at)
       VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,NOW(),NOW())`,
    [userId, tenantId, `${name}-${seq}@e2e.test`]
  );
  const actorId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id)
       VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
    [tenantId, name, userId, gu]
  )).rows[0].id;
  return { userId, actorId };
}

async function mkService(tenantId: string, ownerActorId: string, name: string): Promise<string> {
  seq += 1;
  return (await pool.query<{ id: string }>(
    `INSERT INTO services (tenant_id, actor_id, name, slug, service_type, status, currency)
       VALUES ($1::uuid,$2::uuid,$3,$4,'service','active','BRL') RETURNING service_id::text AS id`,
    [tenantId, ownerActorId, name, `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${seq}`]
  )).rows[0].id;
}

async function mkAvailabilityUserOwned(tenantId: string, ownerActorId: string): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO availability (tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone, capacity, metadata)
       VALUES ($1::uuid,'user',$2::uuid,'fixed','active',$3,$4,'America/Sao_Paulo',1,'{}'::jsonb)
       RETURNING availability_id::text AS id`,
    [tenantId, ownerActorId, new Date('2026-08-01T09:00:00Z'), new Date('2026-08-01T10:00:00Z')]
  )).rows[0].id;
}

async function mkBooking(tenantId: string, availabilityId: string, requesterActorId: string, serviceId: string): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO bookings (tenant_id, availability_id, requester_actor_id, status, metadata, requested_at, created_at, updated_at)
       VALUES ($1::uuid,$2::uuid,$3::uuid,'requested',$4::jsonb,NOW(),NOW(),NOW())
       RETURNING booking_id::text AS id`,
    [tenantId, availabilityId, requesterActorId, JSON.stringify({ serviceId })]
  )).rows[0].id;
}

const statusOf = (e: unknown): number | undefined => (e as { statusCode?: number })?.statusCode;
const decisionCount = (tenantId: string, bookingId: string) =>
  count(`SELECT count(*)::int AS n FROM service_booking_decisions WHERE tenant_id=$1 AND booking_id=$2`, [tenantId, bookingId]);

async function main(): Promise<void> {
  await assertEphemeralDb();

  // socialPortsRegistry (canActAs / canRepresentActor dependem do actor repository).
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Booking Order Binding', slug: `bob-${Date.now()}` });

  const alice = await mkUserActor(TENANT_ID, 'Alice'); // provedora soberana (dona da availability)
  const bob = await mkUserActor(TENANT_ID, 'Bob');     // atacante / provedor alheio
  const carol = await mkUserActor(TENANT_ID, 'Carol'); // cliente (requester)

  const serviceA = await mkService(TENANT_ID, alice.actorId, 'ServicoA'); // services.actor_id = Alice
  const serviceB = await mkService(TENANT_ID, bob.actorId, 'ServicoB');   // services.actor_id = Bob

  const availability = await mkAvailabilityUserOwned(TENANT_ID, alice.actorId); // owner_type=user, owner=Alice
  const booking1 = await mkBooking(TENANT_ID, availability, carol.actorId, serviceA); // metadata.serviceId=A
  const booking3 = await mkBooking(TENANT_ID, availability, carol.actorId, serviceB); // metadata.serviceId=B (alheio)

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  // ── T2 — CONFUSED-DEPUTY: Bob tenta decidir sobre a availability da Alice ──
  {
    let rejected = false; let st: number | undefined;
    try {
      await serviceBookingDecisionService.createDecision(TENANT_ID, bob.userId, {
        bookingId: booking1, decidedByActorId: bob.actorId, status: BookingDecisionStatus.ACCEPTED,
      });
    } catch (e) { rejected = true; st = statusOf(e); }
    const zero = (await decisionCount(TENANT_ID, booking1)) === 0;
    record('T2 confused-deputy (Bob decide slot da Alice) REJEITADO + zero decisão', rejected && zero, `status=${st}`);
  }

  // ── T3 — METADATA SPOOF: serviço declarado (B) não pertence ao dono da availability (Alice) ──
  {
    let rejected = false; let st: number | undefined;
    try {
      await serviceBookingDecisionService.createDecision(TENANT_ID, alice.userId, {
        bookingId: booking3, decidedByActorId: alice.actorId, status: BookingDecisionStatus.ACCEPTED,
      });
    } catch (e) { rejected = true; st = statusOf(e); }
    const zero = (await decisionCount(TENANT_ID, booking3)) === 0;
    record('T3 metadata.serviceId alheio ao dono REJEITADO (409) + zero decisão', rejected && st === 409 && zero, `status=${st}`);
  }

  // ── T7 — REPRESENTABILIDADE: usuário do Bob declara atuar COMO Alice ──
  {
    let rejected = false; let st: number | undefined;
    try {
      await serviceBookingDecisionService.createDecision(TENANT_ID, bob.userId, {
        bookingId: booking1, decidedByActorId: alice.actorId, status: BookingDecisionStatus.ACCEPTED,
      });
    } catch (e) { rejected = true; st = statusOf(e); }
    const zero = (await decisionCount(TENANT_ID, booking1)) === 0;
    record('T7 user do Bob declarando-se Alice REJEITADO + zero decisão', rejected && zero, `status=${st}`);
  }

  // ── T1 / T8 — LEGÍTIMO: Alice decide o próprio slot e confirma a order ──
  let orderId: string | null = null;
  {
    let ok = false; let reason = '';
    try {
      const decision = await serviceBookingDecisionService.createDecision(TENANT_ID, alice.userId, {
        bookingId: booking1, decidedByActorId: alice.actorId, status: BookingDecisionStatus.ACCEPTED,
      });
      const order = await serviceOrderService.confirmBookingFromDecision(
        TENANT_ID, booking1, decision.decisionId, alice.actorId, alice.userId
      );
      orderId = order.id;
      ok = order.workerActorId === alice.actorId; // worker = dono SOBERANO, não metadata
      reason = `worker=${order.workerActorId} esperado=${alice.actorId}`;
    } catch (e) { reason = e instanceof Error ? e.message : String(e); }
    record('T1/T8 fluxo legítimo: decisão+order; worker_actor_id = dono soberano (Alice)', ok, reason);
  }

  // ── T-owner — a order NÃO ficou com worker do serviço-via-metadata por acaso (prova material no DB) ──
  {
    const row = (await pool.query<{ worker: string; svc: string }>(
      `SELECT worker_actor_id::text AS worker, service_id::text AS svc FROM service_orders WHERE booking_id=$1`, [booking1]
    )).rows[0];
    record('T-owner order.worker_actor_id = Alice (dono da availability) no banco', !!row && row.worker === alice.actorId, JSON.stringify(row));
  }

  // ── T5 — DUPLICIDADE: segunda confirmação do mesmo booking + UNIQUE físico ──
  {
    let appBlocked = false;
    try {
      await serviceOrderService.confirmBookingFromDecision(
        TENANT_ID, booking1, (await pool.query<{ d: string }>(`SELECT decision_id::text AS d FROM service_booking_decisions WHERE booking_id=$1`, [booking1])).rows[0].d,
        alice.actorId, alice.userId
      );
    } catch { appBlocked = true; }

    let dbBlocked = false;
    try {
      await pool.query(
        `INSERT INTO service_orders (tenant_id, service_id, worker_actor_id, customer_actor_id, booking_id, status, settlement_flow, scheduled_start, created_by_actor_id, metadata, created_at, updated_at)
           VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,'draft','none',NOW(),$3::uuid,'{}'::jsonb,NOW(),NOW())`,
        [TENANT_ID, serviceA, alice.actorId, carol.actorId, booking1]
      );
    } catch (e) { dbBlocked = /uidx_service_orders_booking_id|unique/i.test(e instanceof Error ? e.message : String(e)); }
    record('T5 duplicidade de order por booking bloqueada (app + UNIQUE físico)', appBlocked && dbBlocked);
  }

  // ── T6 — FK requester: booking com requester_actor_id inexistente é rejeitado ──
  {
    let fkBlocked = false;
    try {
      await pool.query(
        `INSERT INTO bookings (tenant_id, availability_id, requester_actor_id, status, metadata, requested_at, created_at, updated_at)
           VALUES ($1::uuid,$2::uuid,$3::uuid,'requested','{}'::jsonb,NOW(),NOW(),NOW())`,
        [TENANT_ID, availability, randomUUID()]
      );
    } catch (e) { fkBlocked = /bookings_requester_actor_id_fkey|foreign key/i.test(e instanceof Error ? e.message : String(e)); }
    record('T6 FK bookings.requester_actor_id rejeita actor inexistente', fkBlocked);
  }

  // ── T-FKbooking — FK service_orders.booking_id rejeita booking inexistente ──
  {
    let fkBlocked = false;
    try {
      await pool.query(
        `INSERT INTO service_orders (tenant_id, service_id, worker_actor_id, customer_actor_id, booking_id, status, settlement_flow, scheduled_start, created_by_actor_id, metadata, created_at, updated_at)
           VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,'draft','none',NOW(),$3::uuid,'{}'::jsonb,NOW(),NOW())`,
        [TENANT_ID, serviceA, alice.actorId, carol.actorId, randomUUID()]
      );
    } catch (e) { fkBlocked = /service_orders_booking_id_fkey|foreign key/i.test(e instanceof Error ? e.message : String(e)); }
    record('T-FK service_orders.booking_id rejeita booking inexistente', fkBlocked);
  }

  // ── T4 — params.serviceId decorativo: a rota NÃO o passa para createDecision ──
  {
    const routeSrc = readFileSync(join(process.cwd(), 'src/modules/services/service-booking-decision.routes.ts'), 'utf-8');
    const passesBookingFromUrl = /bookingId:\s*req\.params\.bookingId/.test(routeSrc);
    const passesServiceFromUrl = /req\.params\.serviceId/.test(routeSrc);
    record('T4 params.serviceId é decorativo (rota só usa params.bookingId; nunca params.serviceId)', passesBookingFromUrl && !passesServiceFromUrl);
  }

  // ── T9 — Bank intocado ──
  {
    const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
    record('T9 Bank intocado (bank_ledger + bank_transactions inalterados)', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);
  }

  // ── S — apenas 1 service_order no total (booking1) ──
  record('S exatamente 1 service_order criada (booking legítimo)', (await count(`SELECT count(*)::int AS n FROM service_orders`)) === 1, `orderId=${orderId}`);

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
  console.log('✨ booking -> decision -> order vinculado ao dono soberano da availability — confused-deputy contido.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
