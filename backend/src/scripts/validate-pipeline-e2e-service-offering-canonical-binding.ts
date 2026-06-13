/**
 * E2E F-SERVICE-OFFERING-CANONICAL-BINDING (DECISION-0122).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-service-offering-canonical-binding-ephemeral.ps1.
 *
 * Prova que, quando availability.owner_type='service_offering', a OFERTA é o recurso comercial
 * canônico gravado em decision/order (service_offering_id, derivado do SSOT availability.ownerId),
 * provider soberano via resolveAvailabilityOwner; service_id segue legado/projeção; metadata/serviceId
 * legado NÃO autorizam; confused-deputy de oferta falha; Bank/dispute/POST-direto intactos.
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
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/offering|binding|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);
const statusOf = (e: unknown): number | undefined => (e as { statusCode?: number })?.statusCode;

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
async function mkOffering(tenantId: string, providerActorId: string, canonicalServiceId: string, serviceId: string | null): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO service_offerings (tenant_id, canonical_service_id, provider_actor_id, service_id, price_cents, duration_minutes, modality, location, service_area, conditions, status)
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4,5000,45,'in_person','{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'active') RETURNING id::text AS id`,
    [tenantId, canonicalServiceId, providerActorId, serviceId]
  )).rows[0].id;
}
async function mkOfferingAvailability(tenantId: string, offeringId: string): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO availability (tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone, capacity, metadata)
       VALUES ($1::uuid,'service_offering',$2::uuid,'fixed','active',$3,$4,'America/Sao_Paulo',1,'{}'::jsonb) RETURNING availability_id::text AS id`,
    [tenantId, offeringId, new Date('2026-10-01T09:00:00Z'), new Date('2026-10-01T10:00:00Z')]
  )).rows[0].id;
}
async function mkBooking(tenantId: string, availabilityId: string, requesterActorId: string, metadata: Record<string, unknown>): Promise<string> {
  return (await pool.query<{ id: string }>(`INSERT INTO bookings (tenant_id, availability_id, requester_actor_id, status, metadata, requested_at, created_at, updated_at) VALUES ($1::uuid,$2::uuid,$3::uuid,'requested',$4::jsonb,NOW(),NOW(),NOW()) RETURNING booking_id::text AS id`, [tenantId, availabilityId, requesterActorId, JSON.stringify(metadata)])).rows[0].id;
}
const decisionCount = (t: string, b: string) => count(`SELECT count(*)::int AS n FROM service_booking_decisions WHERE tenant_id=$1 AND booking_id=$2`, [t, b]);

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
  await tenantService.createTenant({ id: TENANT_ID, name: 'Service Offering Binding', slug: `sob-${Date.now()}` });
  const canonicalServiceId = (await pool.query<{ id: string }>(`SELECT id::text AS id FROM canonical_services LIMIT 1`)).rows[0]?.id;
  if (!canonicalServiceId) throw new Error('Sem canonical_services no banco efêmero (migrate FULL deveria semear).');

  const alice = await mkUserActor(TENANT_ID, 'Alice'); // provider soberano da oferta
  const bob = await mkUserActor(TENANT_ID, 'Bob');     // provider rival
  const carol = await mkUserActor(TENANT_ID, 'Carol'); // requester

  const serviceA = await mkService(TENANT_ID, alice.actorId, 'ServicoA'); // service_id legado da Alice
  const serviceB = await mkService(TENANT_ID, bob.actorId, 'ServicoB');   // alheio
  const offeringA = await mkOffering(TENANT_ID, alice.actorId, canonicalServiceId, null); // oferta da Alice (service_id null)
  const offeringB = await mkOffering(TENANT_ID, bob.actorId, canonicalServiceId, null);   // oferta do Bob

  const availA = await mkOfferingAvailability(TENANT_ID, offeringA); // owner=service_offering(offeringA)→provider Alice
  const availB = await mkOfferingAvailability(TENANT_ID, offeringB); // owner=service_offering(offeringB)→provider Bob

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  // booking legítimo (metadata.serviceId = serviceA da Alice; metadata.serviceOfferingId SPOOF = offeringB)
  const bookingLegit = await mkBooking(TENANT_ID, availA, carol.actorId, { serviceId: serviceA, serviceOfferingId: offeringB });
  // booking com service alheio (serviceB) sobre a oferta da Alice
  const bookingAlienService = await mkBooking(TENANT_ID, availA, carol.actorId, { serviceId: serviceB });
  // booking sobre a oferta do Bob (provider mismatch quando Alice tenta decidir)
  const bookingBobOffering = await mkBooking(TENANT_ID, availB, carol.actorId, { serviceId: serviceB });

  // ── T2 — CONFUSED-DEPUTY OFFERING: Bob decide a oferta da Alice ──
  {
    let rej = false; let st: number | undefined;
    try { await serviceBookingDecisionService.createDecision(TENANT_ID, bob.userId, { bookingId: bookingLegit, decidedByActorId: bob.actorId, status: BookingDecisionStatus.ACCEPTED }); }
    catch (e) { rej = true; st = statusOf(e); }
    record('T2 confused-deputy oferta (Bob decide oferta da Alice) → rejeitado, 0 decisão', rej && (await decisionCount(TENANT_ID, bookingLegit)) === 0, `status=${st}`);
  }
  // ── T3 — SERVICE_ID LEGADO DIVERGENTE: service alheio (Bob) não autoriza nem contamina ──
  {
    let rej = false; let st: number | undefined;
    try { await serviceBookingDecisionService.createDecision(TENANT_ID, alice.userId, { bookingId: bookingAlienService, decidedByActorId: alice.actorId, status: BookingDecisionStatus.ACCEPTED }); }
    catch (e) { rej = true; st = statusOf(e); }
    record('T3 service_id legado alheio ao provider → 409, 0 decisão', rej && st === 409 && (await decisionCount(TENANT_ID, bookingAlienService)) === 0, `status=${st}`);
  }
  // ── T5 — PROVIDER MISMATCH: Alice tenta decidir oferta do Bob ──
  {
    let rej = false; let st: number | undefined;
    try { await serviceBookingDecisionService.createDecision(TENANT_ID, alice.userId, { bookingId: bookingBobOffering, decidedByActorId: alice.actorId, status: BookingDecisionStatus.ACCEPTED }); }
    catch (e) { rej = true; st = statusOf(e); }
    record('T5 provider mismatch (Alice decide oferta do Bob) → rejeitado, 0 decisão', rej && (await decisionCount(TENANT_ID, bookingBobOffering)) === 0, `status=${st}`);
  }

  // ── T1/T6 — LEGÍTIMO: Alice decide a própria oferta e confirma a order ──
  let orderId: string | null = null;
  {
    let ok = false; let reason = '';
    try {
      const decision = await serviceBookingDecisionService.createDecision(TENANT_ID, alice.userId, { bookingId: bookingLegit, decidedByActorId: alice.actorId, status: BookingDecisionStatus.ACCEPTED });
      // decisão grava a oferta canônica (do SSOT availability), NÃO o offeringB do metadata spoof
      const decRow = (await pool.query<{ so: string | null }>(`SELECT service_offering_id::text AS so FROM service_booking_decisions WHERE decision_id=$1`, [decision.decisionId])).rows[0];
      const order = await serviceOrderService.confirmBookingFromDecision(TENANT_ID, bookingLegit, decision.decisionId, alice.actorId, alice.userId);
      orderId = order.id;
      ok = order.serviceOfferingId === offeringA && order.workerActorId === alice.actorId && decRow?.so === offeringA;
      reason = `order.so=${order.serviceOfferingId} dec.so=${decRow?.so} worker=${order.workerActorId} (esperado offering=${offeringA} worker=${alice.actorId})`;
    } catch (e) { reason = e instanceof Error ? e.message : String(e); }
    record('T1/T6 legítimo: decision+order com service_offering_id=oferta canônica (SSOT), worker=provider', ok, reason);
  }
  // ── T4 — METADATA SPOOF: o serviceOfferingId gravado = oferta da availability (A), não o metadata (B) ──
  {
    const row = (await pool.query<{ so: string }>(`SELECT service_offering_id::text AS so FROM service_orders WHERE booking_id=$1`, [bookingLegit])).rows[0];
    record('T4 metadata.serviceOfferingId spoof (B) IGNORADO; order grava oferta da availability (A)', !!row && row.so === offeringA, `so=${row?.so} spoof=${offeringB}`);
  }
  // ── T6b — service_id legado preservado como projeção (= serviceA da Alice) ──
  {
    const row = (await pool.query<{ sid: string }>(`SELECT service_id::text AS sid FROM service_orders WHERE booking_id=$1`, [bookingLegit])).rows[0];
    record('T6b service_id legado preservado (projeção = serviceA do provider)', !!row && row.sid === serviceA);
  }
  // ── T7 — DUPLICIDADE ──
  {
    let blocked = false;
    try {
      const d = (await pool.query<{ d: string }>(`SELECT decision_id::text AS d FROM service_booking_decisions WHERE booking_id=$1`, [bookingLegit])).rows[0].d;
      await serviceOrderService.confirmBookingFromDecision(TENANT_ID, bookingLegit, d, alice.actorId, alice.userId);
    } catch { blocked = true; }
    record('T7 duplicidade de order por booking segue bloqueada', blocked);
  }
  // ── T8 — POST /service-orders continua 403 ──
  {
    const app = Fastify();
    app.decorateRequest('tenant', null); app.decorateRequest('user', null); app.decorateRequest('actionContext', null);
    await app.register(serviceOrderRoutes); await app.ready();
    const res = await app.inject({ method: 'POST', url: '/service-orders', payload: { serviceId: serviceA, workerActorId: alice.actorId, customerActorId: carol.actorId, serviceOfferingId: offeringA } });
    let code: string | undefined; try { code = JSON.parse(res.body)?.code; } catch { /* noop */ }
    await app.close();
    record('T8 POST /service-orders continua 403 SERVICE_ORDER_DIRECT_CREATE_DISABLED', res.statusCode === 403 && code === 'SERVICE_ORDER_DIRECT_CREATE_DISABLED', `status=${res.statusCode} code=${code}`);
  }
  // ── T9 — dispute/reversal containment intactos ──
  {
    const src = readFileSync(join(process.cwd(), 'src/modules/reconciliation/reconciliation-dispute.routes.ts'), 'utf-8');
    record('T9 dispute/reversal containment intactos', src.includes('DISPUTE_REVERSAL_HTTP_DISABLED') && src.includes('DISPUTE_MUTATION_HTTP_DISABLED'));
  }
  // ── T10 — Bank intocado ──
  record('T10 Bank intocado (bank_ledger + bank_transactions inalterados)', (await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)) === bankBefore);
  // ── S — exatamente 1 service_order ──
  record('S exatamente 1 service_order (caminho canônico)', (await count(`SELECT count(*)::int AS n FROM service_orders`)) === 1, `orderId=${orderId}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ service_offering é o recurso canônico da order quando offering-owned; service_id legado/projeção; metadata não autoriza.');
}
main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
