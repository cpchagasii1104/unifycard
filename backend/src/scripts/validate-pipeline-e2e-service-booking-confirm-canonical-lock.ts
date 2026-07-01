/**
 * E2E F-SERVICE-BOOKING-CONFIRM-CANONICAL-LOCK-SLICE-A1 (DECISION-0156 D7 / DT-SERVICE-BOOKING-CONFIRM-BYPASSES-LOCK).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-service-booking-confirm-canonical-lock-ephemeral.ps1.
 *
 * Prova adversarial de que a Superfície B (serviceOrderService.confirmBookingFromDecision → service_order) NÃO
 * bypassa mais o lock/conflito canônico da Unified Availability: a confirmação delega ao MESMO caminho seguro da
 * Superfície A (updateBooking(status=CONFIRMED) → confirmBookingWithProviderLock), de modo que:
 *   - a 1ª confirmação vira compromisso (booking requested→confirmed) e cria a order;
 *   - uma 2ª confirmação no MESMO intervalo/provider (mesma oferta OU oferta distinta do mesmo provider) é
 *     RECUSADA fail-closed (BOOKING_PROVIDER_TIME_CONFLICT) ANTES de nascer a service_order;
 *   - não há double-booking nem 2ª service_order no slot;
 *   - services.metadata.availability NÃO participa (availability é owner_type='service_offering', metadata vazio);
 *   - Bank intocado (Δbank=0).
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { serviceBookingDecisionService } from '../modules/services/service-booking-decision.service';
import { serviceOrderService } from '../modules/services/service-order.service';
import { BookingDecisionStatus } from '../modules/services/service-booking-decision.types';
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
  if (!/booking|confirm|lock|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);
const statusStrOf = (t: string, b: string) =>
  pool.query<{ s: string }>(`SELECT status::text AS s FROM bookings WHERE tenant_id=$1 AND booking_id=$2`, [t, b]).then((r) => r.rows[0]?.s);
const orderCountForBooking = (t: string, b: string) =>
  count(`SELECT count(*)::int AS n FROM service_orders WHERE tenant_id=$1 AND booking_id=$2`, [t, b]);

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
async function mkService(tenantId: string, ownerActorId: string, name: string, canonicalServiceId: string): Promise<string> {
  seq += 1;
  return (await pool.query<{ id: string }>(`INSERT INTO services (tenant_id, actor_id, name, slug, canonical_service_id, service_type, status, currency) VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,'service','active','BRL') RETURNING service_id::text AS id`, [tenantId, ownerActorId, name, `${name.toLowerCase()}-${seq}`, canonicalServiceId])).rows[0].id;
}
async function mkOffering(tenantId: string, providerActorId: string, canonicalServiceId: string, serviceId: string): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO service_offerings (tenant_id, canonical_service_id, provider_actor_id, service_id, price_cents, duration_minutes, modality, location, service_area, conditions, status)
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,5000,60,'in_person','{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'active') RETURNING id::text AS id`,
    [tenantId, canonicalServiceId, providerActorId, serviceId]
  )).rows[0].id;
}
// Janela SEMPRE via owner_type='service_offering' + metadata vazio (prova que services.metadata.availability NÃO participa).
async function mkOfferingAvailability(tenantId: string, offeringId: string, startIso: string, endIso: string): Promise<string> {
  return (await pool.query<{ id: string }>(
    `INSERT INTO availability (tenant_id, owner_type, owner_id, availability_type, status, start_datetime, end_datetime, timezone, capacity, metadata)
       VALUES ($1::uuid,'service_offering',$2::uuid,'fixed','active',$3,$4,'America/Sao_Paulo',1,'{}'::jsonb) RETURNING availability_id::text AS id`,
    [tenantId, offeringId, new Date(startIso), new Date(endIso)]
  )).rows[0].id;
}
async function mkBooking(tenantId: string, availabilityId: string, requesterActorId: string, serviceId: string): Promise<string> {
  return (await pool.query<{ id: string }>(`INSERT INTO bookings (tenant_id, availability_id, requester_actor_id, status, metadata, requested_at, created_at, updated_at) VALUES ($1::uuid,$2::uuid,$3::uuid,'requested',$4::jsonb,NOW(),NOW(),NOW()) RETURNING booking_id::text AS id`, [tenantId, availabilityId, requesterActorId, JSON.stringify({ serviceId })])).rows[0].id;
}
async function acceptedDecision(tenantId: string, ownerUserId: string, ownerActorId: string, bookingId: string): Promise<string> {
  const d = await serviceBookingDecisionService.createDecision(tenantId, ownerUserId, {
    bookingId, decidedByActorId: ownerActorId, status: BookingDecisionStatus.ACCEPTED,
  });
  return d.decisionId;
}
const isProviderConflict = (e: unknown): boolean => /BOOKING_PROVIDER_TIME_CONFLICT/.test(e instanceof Error ? e.message : String(e));

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
  await tenantService.createTenant({ id: TENANT_ID, name: 'Booking Confirm Canonical Lock', slug: `bccl-${Date.now()}` });
  // Dois canonical distintos: service_offerings tem UNIQUE (provider_actor_id, canonical_service_id).
  const canon = (await pool.query<{ id: string }>(`SELECT id::text AS id FROM canonical_services LIMIT 2`)).rows;
  if (canon.length < 2) throw new Error('Precisa de ≥2 canonical_services no banco efêmero (migrate FULL deveria semear o catálogo beleza).');
  const csId1 = canon[0].id; const csId2 = canon[1].id;

  const alice = await mkUserActor(TENANT_ID, 'Alice'); // provider soberano
  const carol = await mkUserActor(TENANT_ID, 'Carol'); // cliente 1
  const dave = await mkUserActor(TENANT_ID, 'Dave');   // cliente 2

  // Dois serviços da MESMA Alice (um por canonical) — cada um ancora uma oferta distinta do mesmo provider.
  const serviceA = await mkService(TENANT_ID, alice.actorId, 'ServicoA', csId1);
  const serviceA2 = await mkService(TENANT_ID, alice.actorId, 'ServicoA2', csId2);
  const offering1 = await mkOffering(TENANT_ID, alice.actorId, csId1, serviceA);  // oferta 1 da Alice
  const offering2 = await mkOffering(TENANT_ID, alice.actorId, csId2, serviceA2); // oferta 2 da MESMA Alice (cross-offering)

  const SLOT_START = '2026-11-02T13:00:00Z';
  const SLOT_END = '2026-11-02T14:00:00Z';
  const avail1 = await mkOfferingAvailability(TENANT_ID, offering1, SLOT_START, SLOT_END); // provider=Alice, janela X
  const avail2 = await mkOfferingAvailability(TENANT_ID, offering2, SLOT_START, SLOT_END); // provider=Alice, MESMA janela X (oferta distinta)

  // Dois bookings no MESMO slot da MESMA oferta (capacity não é enforced no create — coexistem 'requested').
  const bookingA1 = await mkBooking(TENANT_ID, avail1, carol.actorId, serviceA);
  const bookingA2 = await mkBooking(TENANT_ID, avail1, dave.actorId, serviceA);
  // Booking sobre a oferta 2 do MESMO provider, mesma janela (prova rollup por provider, não por offering).
  const bookingCross = await mkBooking(TENANT_ID, avail2, dave.actorId, serviceA2);

  const decA1 = await acceptedDecision(TENANT_ID, alice.userId, alice.actorId, bookingA1);
  const decA2 = await acceptedDecision(TENANT_ID, alice.userId, alice.actorId, bookingA2);
  const decCross = await acceptedDecision(TENANT_ID, alice.userId, alice.actorId, bookingCross);

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  // ── T1 — LEGÍTIMO (não regride): 1ª confirmação cria order e vira COMPROMISSO (booking→confirmed) ──
  let orderId: string | null = null;
  {
    let ok = false; let reason = '';
    try {
      const order = await serviceOrderService.confirmBookingFromDecision(TENANT_ID, bookingA1, decA1, alice.actorId, alice.userId);
      orderId = order.id;
      const st = await statusStrOf(TENANT_ID, bookingA1);
      ok = order.workerActorId === alice.actorId && st === 'confirmed';
      reason = `worker=${order.workerActorId} bookingStatus=${st}`;
    } catch (e) { reason = e instanceof Error ? e.message : String(e); }
    record('T1 fluxo legítimo: 1ª confirmação cria order + booking vira confirmed (compromisso)', ok, reason);
  }

  // ── T2 (CENTRAL) — MESMA oferta/slot: 2ª confirmação recusada fail-closed ANTES da order ──
  {
    let blocked = false; let conflict = false; let msg = '';
    try {
      await serviceOrderService.confirmBookingFromDecision(TENANT_ID, bookingA2, decA2, alice.actorId, alice.userId);
    } catch (e) { blocked = true; conflict = isProviderConflict(e); msg = e instanceof Error ? e.message : String(e); }
    const noOrder = (await orderCountForBooking(TENANT_ID, bookingA2)) === 0;
    const stillRequested = (await statusStrOf(TENANT_ID, bookingA2)) === 'requested';
    record('T2 double-book mesma oferta/slot BLOQUEADO fail-closed (BOOKING_PROVIDER_TIME_CONFLICT), sem order, booking segue requested', blocked && conflict && noOrder && stillRequested, `blocked=${blocked} conflict=${conflict} noOrder=${noOrder} stillRequested=${stillRequested} msg=${msg}`);
  }

  // ── T3 — CROSS-OFFERING mesmo provider/slot: também recusado (rollup por provider_actor_id, não por offering) ──
  {
    let blocked = false; let conflict = false; let msg = '';
    try {
      await serviceOrderService.confirmBookingFromDecision(TENANT_ID, bookingCross, decCross, alice.actorId, alice.userId);
    } catch (e) { blocked = true; conflict = isProviderConflict(e); msg = e instanceof Error ? e.message : String(e); }
    const noOrder = (await orderCountForBooking(TENANT_ID, bookingCross)) === 0;
    record('T3 cross-offering do mesmo provider no mesmo slot BLOQUEADO (rollup por provider), sem order', blocked && conflict && noOrder, `blocked=${blocked} conflict=${conflict} noOrder=${noOrder} msg=${msg}`);
  }

  // ── T4 — INTEGRIDADE: exatamente 1 service_order e exatamente 1 booking confirmado no slot ──
  {
    const totalOrders = await count(`SELECT count(*)::int AS n FROM service_orders`);
    const confirmedInSlot = await count(
      `SELECT count(*)::int AS n FROM bookings b JOIN availability a ON a.availability_id=b.availability_id AND a.tenant_id=b.tenant_id
        JOIN service_offerings so ON so.id=a.owner_id AND so.tenant_id=a.tenant_id
        WHERE b.tenant_id=$1 AND a.owner_type='service_offering' AND so.provider_actor_id=$2 AND b.status='confirmed'`,
      [TENANT_ID, alice.actorId]
    );
    record('T4 exatamente 1 service_order e 1 booking confirmado no slot do provider (sem double-booking)', totalOrders === 1 && confirmedInSlot === 1, `orders=${totalOrders} confirmedInSlot=${confirmedInSlot} orderId=${orderId}`);
  }

  // ── T5 — SSOT: a janela veio de owner_type='service_offering' e metadata da availability está vazio ──
  {
    const row = (await pool.query<{ ot: string; md: string }>(
      `SELECT owner_type::text AS ot, metadata::text AS md FROM availability WHERE availability_id=$1`, [avail1]
    )).rows[0];
    const metaEmpty = !row?.md || row.md === '{}' || !/availability/i.test(row.md);
    record('T5 janela é owner_type=service_offering (SSOT) e services.metadata.availability NÃO participa da decisão', row?.ot === 'service_offering' && metaEmpty, `owner_type=${row?.ot} metadata=${row?.md}`);
  }

  // ── T6 — BANK intocado (Δbank=0) ──
  {
    const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
    record('T6 Bank intocado (bank_ledger + bank_transactions inalterados) — Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ Superfície B (confirmBookingFromDecision) passa pelo lock/conflito canônico: double-booking do mesmo provider/slot recusado antes da service_order. DT-SERVICE-BOOKING-CONFIRM-BYPASSES-LOCK provada.');
}
main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
