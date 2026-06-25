/**
 * E2E F-SERVICE-BOOKING-DECISION-QUARANTINE-GATE (§4.8.4).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-service-booking-decision-quarantine-gate-ephemeral.ps1.
 *
 * Prova que o provider/dono soberano (authority actor resolvido via availability owner) cujo actor está bloqueado
 * NÃO pode DECIDIR booking (createDecision) NEM CONFIRMAR em service_order (confirmBookingFromDecision) — as DUAS
 * portas. A "porta" (decisão) e a "sala atrás dela" (order) trancadas. canRepresentActor segue puro; money-free.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import { professionalC1Repository } from '../core/profile/professional-c1/professional-c1.repository';
import { servicesService } from '../modules/services/services.service';
import { ServiceType } from '../modules/services/services.types';
import { serviceOfferingService } from '../modules/services/service-offering.service';
import { unifiedAvailabilityService } from '../core/availability/unified-availability.service';
import { serviceBookingDecisionService } from '../modules/services/service-booking-decision.service';
import { BookingDecisionStatus } from '../modules/services/service-booking-decision.types';
import { serviceOrderService } from '../modules/services/service-order.service';
import { serviceOrderRepository } from '../modules/services/service-order.repository';
import { authorizationService } from '../core/authorization/authorization.service';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);
const errOf = (e: any): { code?: string; status?: number; msg: string } => ({ code: e?.code, status: e?.statusCode, msg: e?.message || String(e) });
// quarentena pode vir da fachada (canPerformAction → 'Actor effectively blocked (...)') OU do meu gate
// (assertAuthorityActorActive → code ACTOR_EFFECTIVELY_BLOCKED / msg 'quarentena'). Ambos = 403 fail-closed.
const isQuarantine403 = (err: any): boolean => err?.status === 403 && /effectively blocked|ACTOR_EFFECTIVELY_BLOCKED|quarentena/i.test(`${err?.code || ''} ${err?.msg || ''}`);
const isMyGate403 = (err: any): boolean => err?.status === 403 && (err?.code === 'ACTOR_EFFECTIVELY_BLOCKED' || /Autoridade do recurso|quarentena/i.test(err?.msg || ''));
const SERVICOS_CATEGORY_ID = '11200000-0000-0000-0000-000000000103';

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/booking|decision|quarantine|service|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function seedCivilActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1; const gu = randomUUID(); const userId = randomUUID();
  const cpf = String(Date.now() + seq * 53).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, cpf, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name.toLowerCase()}-${seq}@e2e.test`, gu]);
  const actor = await ensureUserActor(tenantId, userId);
  return { userId, actorId: actor.actor_id };
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const sa = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(sa.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(sa.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(sa.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(sa.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(sa.eventFeedHandlersAdapter);

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Booking Decision Quarantine', slug: `bdq-${Date.now()}` });

  const conceptId = randomUUID();
  { const gc = await pool.connect(); try { await gc.query('BEGIN'); await gc.query(`SELECT set_config('app.concept_governance','true', true)`); await gc.query(`INSERT INTO concepts (concept_id, slug, domain) VALUES ($1::uuid,$2,'servicos')`, [conceptId, `bdq-${conceptId.slice(0, 8)}`]); await gc.query('COMMIT'); } catch (e) { await gc.query('ROLLBACK'); throw e; } finally { gc.release(); } }
  const canonicalId = randomUUID();
  await pool.query(`INSERT INTO canonical_services (id, tenant_id, scope, concept_id, name, slug, status) VALUES ($1::uuid,$2::uuid,'scoped',$3::uuid,$4,$5,'active')`, [canonicalId, TENANT_ID, conceptId, 'BDQ Canonical', `bdq-canonical-${canonicalId.slice(0, 8)}`]);

  const operator = await seedCivilActor(TENANT_ID, 'OpProvider');
  const consumer = await seedCivilActor(TENANT_ID, 'ConsumerC');
  await professionalC1Repository.declareConcept(TENANT_ID, operator.actorId, { conceptId, skillLevel: 3 });

  const service = await servicesService.createService(TENANT_ID, operator.userId, { actorId: operator.actorId, name: 'BDQ Service', categoryId: SERVICOS_CATEGORY_ID, canonicalServiceId: canonicalId, serviceType: ServiceType.SERVICE });
  const { offering } = await serviceOfferingService.createOffering({ tenantId: TENANT_ID, userId: operator.userId, providerActorId: operator.actorId, canonicalServiceId: canonicalId, priceCents: 5000, durationMinutes: 45, modality: 'in_person' });
  await serviceOfferingService.updateOwnOffering({ tenantId: TENANT_ID, userId: operator.userId, offeringId: offering.id, status: 'active' });

  // 4 janelas + 4 bookings 'requested' ANTES de bloquear (após o bloqueio, declareAvailability também é barrada).
  const bookings: string[] = [];
  for (let i = 0; i < 4; i++) {
    const av = await serviceOfferingService.declareAvailability({ tenantId: TENANT_ID, userId: operator.userId, offeringId: offering.id, startDatetime: `2030-11-0${i + 1}T09:00:00Z`, endDatetime: `2030-11-0${i + 1}T10:00:00Z`, capacity: 1 });
    const b = await unifiedAvailabilityService.createBooking(TENANT_ID, { subjectUserId: consumer.userId, requesterActorId: consumer.actorId }, { availabilityId: av.availabilityId, requesterActorId: consumer.actorId, metadata: { serviceId: service.serviceId } } as any);
    bookings.push(b.bookingId);
  }

  const bankSql = `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`;
  const bankBefore = await count(bankSql);

  // ── T1 — fluxo canônico (não-bloqueado): decision ACCEPTED → service_order ──
  let decision1: string | undefined; let decision2: string | undefined;
  {
    const d = await serviceBookingDecisionService.createDecision(TENANT_ID, operator.userId, { bookingId: bookings[0], decidedByActorId: operator.actorId, status: BookingDecisionStatus.ACCEPTED });
    decision1 = d.decisionId;
    const order = await serviceOrderService.confirmBookingFromDecision(TENANT_ID, bookings[0], d.decisionId, operator.actorId, operator.userId);
    record('T1 não-bloqueado → decision ACCEPTED + service_order via confirm (settlement_flow=none)', !!d.decisionId && order.workerActorId === operator.actorId && order.customerActorId === consumer.actorId);
  }
  // decision2 (não-bloqueado) p/ testar confirm-bloqueado depois
  { const d = await serviceBookingDecisionService.createDecision(TENANT_ID, operator.userId, { bookingId: bookings[1], decidedByActorId: operator.actorId, status: BookingDecisionStatus.ACCEPTED }); decision2 = d.decisionId; }

  // ── bloquear o operador (provider/dono soberano) ──
  await pool.query(`INSERT INTO atl_blocked_actors (actor_id, tenant_id, blocked_reason) VALUES ($1::uuid,$2::uuid,'e2e quarantine')`, [operator.actorId, TENANT_ID]);

  // ── T2 — PORTA 1: createDecision (ACCEPT) bloqueado → 403 (fachada canPerformAction:60, já existente) ──
  {
    const r = await serviceBookingDecisionService.createDecision(TENANT_ID, operator.userId, { bookingId: bookings[2], decidedByActorId: operator.actorId, status: BookingDecisionStatus.ACCEPTED }).then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
    record('T2 PORTA 1: createDecision ACCEPT bloqueado → 403 (fachada já cobria; gate é defesa-em-profundidade)', r.ok === false && isQuarantine403(r.err), JSON.stringify(r.err));
  }
  // ── T3 — createDecision (REJECT) bloqueado → 403 (mesmo gate, status-agnóstico) ──
  {
    const r = await serviceBookingDecisionService.createDecision(TENANT_ID, operator.userId, { bookingId: bookings[3], decidedByActorId: operator.actorId, status: BookingDecisionStatus.REJECTED }).then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
    record('T3 createDecision REJECT bloqueado → 403', r.ok === false && isQuarantine403(r.err), JSON.stringify(r.err));
  }
  // ── T4 — nenhuma decisão nasceu para os bookings bloqueados ──
  record('T4 bloqueado → nenhuma decisão em service_booking_decisions (b3/b4)', (await count(`SELECT count(*)::int AS n FROM service_booking_decisions WHERE tenant_id=$1 AND booking_id = ANY($2::uuid[])`, [TENANT_ID, [bookings[2], bookings[3]]])) === 0);

  // ── T5 — PORTA 2 (a sala atrás): confirmBookingFromDecision COM userId bloqueado → 403 (fachada:1356) ──
  {
    const r = await serviceOrderService.confirmBookingFromDecision(TENANT_ID, bookings[1], decision2!, operator.actorId, operator.userId).then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
    record('T5 PORTA 2 (com userId): confirmBookingFromDecision bloqueado → 403', r.ok === false && isQuarantine403(r.err), JSON.stringify(r.err));
  }
  // ── T5b — 🔴 GAP REAL FECHADO: confirmBookingFromDecision SEM userId (fachada:1356 é PULADA por if(confirmedByUserId)) ──
  //          → só o MEU gate (assertAuthorityActorActive:1423) protege. Prova o valor único desta frente.
  {
    const r = await serviceOrderService.confirmBookingFromDecision(TENANT_ID, bookings[1], decision2!, operator.actorId, undefined).then(() => ({ ok: true } as any)).catch((e) => ({ ok: false, err: errOf(e) }));
    record('T5b GAP REAL: confirm SEM userId (fachada pulada) → 403 pelo MEU gate (code ACTOR_EFFECTIVELY_BLOCKED)', r.ok === false && isMyGate403(r.err), JSON.stringify(r.err));
  }
  // ── T6 — nenhuma service_order nasceu para o booking bloqueado (b2) ──
  record('T6 bloqueado → nenhuma service_order para b2', (await serviceOrderRepository.listOrders(TENANT_ID, { bookingId: bookings[1], limit: 5 })).length === 0);

  // ── T7 — representação pura ──
  record('T7 canRepresentActor segue TRUE bloqueado (representação ≠ autoridade-ativa)', (await authorizationService.canRepresentActor(TENANT_ID, operator.userId, operator.actorId)) === true);

  // ── T8 — schedules/schedule_slots sem write ──
  record('T8 schedules/schedule_slots sem write', (await count(`SELECT (COALESCE((SELECT count(*) FROM schedules),0)+COALESCE((SELECT count(*) FROM schedule_slots),0))::int AS n`).catch(() => 0)) === 0);

  // ── T9 — Δbank=0 ──
  record('T9 Δbank=0 (decisão/order de booking é money-free; settlement_flow=none)', (await count(bankSql)) === bankBefore, `before=${bankBefore}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:'); failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end(); process.exit(1);
  }
  await pool.end();
  console.log('✨ provider bloqueado não DECIDE (porta) nem CONFIRMA em service_order (sala); fluxo não-bloqueado intacto; canRepresentActor puro; schedules vazio; Δbank=0.');
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
