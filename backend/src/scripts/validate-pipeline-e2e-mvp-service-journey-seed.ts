/**
 * E2E F-MVP-SERVICE-JOURNEY-SEED — FASE 2 MATERIAL CONTIDA (money-free, actor-first).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-mvp-service-journey-seed-ephemeral.ps1 (cria DB, migra FULL, roda, DROPA).
 *
 * Prova, com DADOS SINTÉTICOS e via WRITERS CANÔNICOS, que a espinha mínima do MVP de serviço fecha
 * ponta-a-ponta SEM tocar dinheiro:
 *
 *   concept (servicos) → canonical_service ACTIVE → declaração profissional PF (caminho canônico) →
 *   service (writer canônico, herda elegibilidade) → service_offering DRAFT →
 *   ATIVAÇÃO via GATE REAL de elegibilidade (declaração + civil mínima + não-bloqueado — NÃO bypass) →
 *   availability (owner='service_offering') → booking 'requested' (consumidor) →
 *   decision ACCEPTED (operador, dono soberano) → service_order via confirmBookingFromDecision
 *   (settlement_flow='none') → my-orders (consumidor) + service-orders worker (operador) →
 *   atendimento mínimo via inbox AUTO-EMITIDO no nascimento da service_order (read-model, sem test-only).
 *
 * Actor-first: MESMO actor_type='user' para consumidor e operador; a distinção é por PAPEL/CONTEXTO
 * (quem declara/decide a oferta = operação; quem requisita = consumo), nunca por hardcode/tipo paralelo.
 * Semântica: UM concept_id atravessa concept → canonical_service → declaração → gate de ativação.
 *
 * Cenário: PF provider. PF e PJ são ontologicamente equivalentes como ofertantes (PF_PRESTADOR_CANONICO D17);
 * PJ provider (publicação + KYB + empresa operacional) fica para o próximo cenário (ver relatório).
 *
 * NÃO toca dinheiro/payout/ledger; settlement_flow='none'; Δbank=0; flags financeiras off; workers off.
 * POST /service-orders direto continua 403. CRM/evidence/invoicing FORA. Inbox AUTO-EMITIDO (money/CRM-free).
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
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
import { socialInboxService } from '../modules/inbox/social-inbox.service';
import { InboxSourceType } from '../modules/inbox/social-inbox.types';
import serviceOrderRoutes from '../modules/services/service-order.routes';

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
  if (!/mvp|service|journey|seed|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);
const statusOf = (e: unknown): number | undefined => (e as { statusCode?: number })?.statusCode;

// Categoria de serviço seedada pela migration FULL (20260418100000_servicos_operational_categories_seed):
// 'Estética e bem-estar', metadata.domain='servicos' → satisfaz o guard DECISION-0109 para PF (sem empresa).
const SERVICOS_CATEGORY_ID = '11200000-0000-0000-0000-000000000103';

let seq = 0;

/**
 * Seed de SUBSTRATO civil mínimo (sem writer canônico runtime fora do register HTTP) + ACTOR via WRITER CANÔNICO
 * (ensureUserActor → findOrCreateUserActor). global_users(cpf+full_name) e identities satisfazem a elegibilidade
 * civil mínima PF do gate de ativação; users.global_user_id é a âncora exigida pelo writer de actor (DECISION-0062).
 */
async function seedCivilActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const cpf = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, cpf, name]);
  await pool.query(
    `INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`,
    [gu, cpf]
  );
  await pool.query(
    `INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at)
       VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`,
    [userId, tenantId, `${name.toLowerCase()}-${seq}@e2e.test`, gu]
  );
  const actor = await ensureUserActor(tenantId, userId); // WRITER CANÔNICO de actor (§4.8)
  return { userId, actorId: actor.actor_id, globalUserId: gu };
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  // DI dos social ports (canRepresentActor/canActAs dependem do actor repository) — mesma wiring do app.builder.
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'MVP Service Journey Seed', slug: `msjs-${Date.now()}` });

  // ── SEMÂNTICA: UM concept_id (domain='servicos') atravessa toda a cadeia ──
  // `concepts` é GOVERNADO (0075_concept_governance_trigger): INSERT exige app.concept_governance='true'
  // em transação autorizada — caminho SANCIONADO pelo próprio trigger (não bypass). Seed test-only.
  const conceptId = randomUUID();
  {
    const gc = await pool.connect();
    try {
      await gc.query('BEGIN');
      await gc.query(`SELECT set_config('app.concept_governance','true', true)`);
      await gc.query(`INSERT INTO concepts (concept_id, slug, domain) VALUES ($1::uuid,$2,'servicos')`, [conceptId, `mvp-seed-${conceptId.slice(0, 8)}`]);
      await gc.query('COMMIT');
    } catch (e) { await gc.query('ROLLBACK'); throw e; } finally { gc.release(); }
  }
  const canonicalId = randomUUID();
  await pool.query(
    `INSERT INTO canonical_services (id, tenant_id, scope, concept_id, name, slug, status)
       VALUES ($1::uuid,$2::uuid,'scoped',$3::uuid,$4,$5,'active')`,
    [canonicalId, TENANT_ID, conceptId, 'MVP Seed Canonical', `mvp-seed-canonical-${canonicalId.slice(0, 8)}`]
  );

  // ── IDENTIDADE/ACTOR (caminho canônico): operador (presta/opera) + consumidor (consome) ──
  const operator = await seedCivilActor(TENANT_ID, 'AliceOperador'); // modo OPERAÇÃO
  const consumer = await seedCivilActor(TENANT_ID, 'CarolConsumidor'); // modo CONSUMO
  record('A actor consumidor e actor operador criados pelo caminho canônico (ensureUserActor, mesmo actor_type=user)',
    !!operator.actorId && !!consumer.actorId && operator.actorId !== consumer.actorId,
    `operador=${operator.actorId} consumidor=${consumer.actorId}`);

  const bankBefore = await count(
    `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`
  );

  // ── AUTORIDADE/SEMÂNTICA: declaração profissional PF ACTIVE do MESMO concept (writer canônico) ──
  await professionalC1Repository.declareConcept(TENANT_ID, operator.actorId, { conceptId, skillLevel: 3 });
  const declActive = await count(
    `SELECT count(*)::int AS n FROM actor_professional_concepts WHERE tenant_id=$1 AND actor_id=$2 AND concept_id=$3 AND is_active=true`,
    [TENANT_ID, operator.actorId, conceptId]
  );
  record('B declaração profissional PF ACTIVE do concept (caminho canônico; concept_id atravessa)', declActive === 1, `n=${declActive}`);

  // ── SERVICE (writer canônico; herda elegibilidade da declaração — DECISION-0144/0145) ──
  const service = await servicesService.createService(TENANT_ID, operator.userId, {
    actorId: operator.actorId,
    name: 'MVP Seed Service',
    categoryId: SERVICOS_CATEGORY_ID,
    canonicalServiceId: canonicalId,
    serviceType: ServiceType.SERVICE,
  });
  record('C service criado via writer canônico (vinculado ao canonical/concept)', !!service.serviceId, `serviceId=${service.serviceId}`);

  // ── OFFERING nasce DRAFT (writer canônico) ──
  const { offering } = await serviceOfferingService.createOffering({
    tenantId: TENANT_ID,
    userId: operator.userId,
    providerActorId: operator.actorId,
    canonicalServiceId: canonicalId,
    priceCents: 5000,
    durationMinutes: 45,
    modality: 'in_person',
  });
  record('D offering nasce DRAFT (criação ≠ ativação)', offering.status === 'draft', `status=${offering.status}`);

  // ── G1 — ATIVAÇÃO via GATE REAL de elegibilidade (declaração + civil mínima + não-bloqueado). NÃO bypass. ──
  await serviceOfferingService.updateOwnOffering({ tenantId: TENANT_ID, userId: operator.userId, offeringId: offering.id, status: 'active' });
  const offActive = await serviceOfferingService.findById(TENANT_ID, offering.id);
  record('G1 offering ATIVADO via GATE canônico (status=active; sem forçar/bypass)', offActive?.status === 'active', `status=${offActive?.status}`);

  // ── TEMPO — availability (writer canônico; SSOT físico availability, owner='service_offering') ──
  const avail = await serviceOfferingService.declareAvailability({
    tenantId: TENANT_ID,
    userId: operator.userId,
    offeringId: offering.id,
    startDatetime: '2026-11-01T09:00:00Z',
    endDatetime: '2026-11-01T10:00:00Z',
    capacity: 1,
  });
  const avRow = (await pool.query<{ owner_type: string; owner_id: string }>(
    `SELECT owner_type, owner_id::text AS owner_id FROM availability WHERE availability_id=$1`, [avail.availabilityId]
  )).rows[0];
  record('E availability criada em availability (owner=service_offering; SSOT temporal físico)',
    avRow?.owner_type === 'service_offering' && avRow?.owner_id === offering.id, JSON.stringify(avRow));
  const ghostSchedules = await count(`SELECT (SELECT count(*) FROM schedules)::int AS n`).catch(() => 0);
  record('E2 zero schedules/schedule_slots tocados (SSOT temporal = availability, não legado C63)', ghostSchedules === 0, `schedules=${ghostSchedules}`);

  // ── ESTADO — booking 'requested' pelo CONSUMIDOR (writer canônico; re-checa offering active) ──
  const booking = await unifiedAvailabilityService.createBooking(
    TENANT_ID,
    { subjectUserId: consumer.userId, requesterActorId: consumer.actorId },
    { availabilityId: avail.availabilityId, requesterActorId: consumer.actorId, metadata: { serviceId: service.serviceId } } as any
  );
  record('F booking nasce requested (consumidor requisita; modo CONSUMO)', booking.status === 'requested', `status=${booking.status}`);

  // ── decision ACCEPTED pelo OPERADOR (dono soberano da oferta; writer canônico) ──
  const decision = await serviceBookingDecisionService.createDecision(TENANT_ID, operator.userId, {
    bookingId: booking.bookingId,
    decidedByActorId: operator.actorId,
    status: BookingDecisionStatus.ACCEPTED,
  });
  record('G decision ACCEPTED pelo operador (dono soberano; modo OPERAÇÃO)', !!decision.decisionId, `decisionId=${decision.decisionId}`);

  // ── G2 — service_order via confirmBookingFromDecision (caminho canônico; settlement_flow='none') ──
  const order = await serviceOrderService.confirmBookingFromDecision(TENANT_ID, booking.bookingId, decision.decisionId, operator.actorId, operator.userId);
  record('G2 service_order criada via confirmBookingFromDecision (worker=operador, customer=consumidor)',
    order.workerActorId === operator.actorId && order.customerActorId === consumer.actorId,
    `worker=${order.workerActorId} customer=${order.customerActorId}`);
  const soRow = (await pool.query<{ sf: string; so: string | null; sid: string | null }>(
    `SELECT settlement_flow AS sf, service_offering_id::text AS so, service_id::text AS sid FROM service_orders WHERE id=$1`, [order.id]
  )).rows[0];
  record('G2b service_order.settlement_flow = "none" (money-free)', soRow?.sf === 'none', `settlement_flow=${soRow?.sf}`);
  record('G2c service_order grava a oferta canônica (service_offering_id da availability)', soRow?.so === offering.id, `so=${soRow?.so} esperado=${offering.id}`);

  // ── my-orders: consumidor enxerga (read-model canônico) + operador enxerga (service-orders worker view) ──
  // O read-model do CONSUMIDOR é serviceOrderRepository.listOrders(customer view) — a FONTE canônica que o
  // módulo my-orders consome (my-orders.service:22). NÃO chamamos myOrdersService.listMyOrders porque ele DECORA
  // com evidence/invoice/agreements (CRM/evidence/invoicing) — superfícies FORA desta frente por contrato.
  const consumerOrders = await serviceOrderRepository.listOrders(TENANT_ID, { customerActorId: consumer.actorId, limit: 1000 });
  const consumerSees = consumerOrders.some((o) => o.id === order.id);
  record('H my-orders (read-model canônico, customer view) retorna a ordem para o CONSUMIDOR', consumerSees, `itens=${consumerOrders.length}`);
  const operatorOrders = await serviceOrderRepository.listOrders(TENANT_ID, { workerActorId: operator.actorId, limit: 1000 });
  const operatorSees = operatorOrders.some((o) => o.id === order.id);
  record('H2 service-orders worker view retorna a ordem para o OPERADOR (provider view)', operatorSees, `itens=${operatorOrders.length}`);

  // ── HANDOFF-6 — atendimento mínimo: inbox AUTO-EMITIDO no nascimento da service_order (F-SERVICE-ORDER-INBOX-AUTO-EMIT) ──
  // SEM insert test-only: o item nasce DENTRO de confirmBookingFromDecision (read-model do provider/worker).
  const inbox = await socialInboxService.getInboxItems(TENANT_ID, operator.actorId);
  const orderItem = inbox.find((i) => i.sourceId === order.id && i.sourceType === InboxSourceType.ORDER);
  record('I atendimento mínimo: inbox AUTO-EMITIDO (sourceType=ORDER, sourceId=order.id) para o operador/provider',
    !!orderItem, `itens=${inbox.length} effect=${orderItem?.metadata?.effectType}`);
  record('I2 inbox auto-emitido é canônico (effectType=SERVICE_ORDER_CONFIRMED, NÃO e2e-test-only)',
    !!orderItem && orderItem.metadata?.effectType === 'SERVICE_ORDER_CONFIRMED' && orderItem.metadata?.origin !== 'e2e-test-only');
  // Idempotência por referência: reprojetar o MESMO nascimento NÃO duplica (ON CONFLICT actor_id+source_type+source_id).
  const { socialInboxProjector } = await import('../modules/inbox/social-inbox.projector');
  await socialInboxProjector.projectServiceOrderConfirmed(TENANT_ID, { serviceOrderId: order.id, providerActorId: operator.actorId, bookingId: booking.bookingId, decisionId: decision.decisionId, serviceId: service.serviceId });
  const inboxAfter = await socialInboxService.getInboxItems(TENANT_ID, operator.actorId);
  const orderItems = inboxAfter.filter((i) => i.sourceId === order.id && i.sourceType === InboxSourceType.ORDER);
  record('I3 idempotência: reprojetar o mesmo service_order NÃO duplica inbox (exatamente 1 item ORDER)', orderItems.length === 1, `itens_order=${orderItems.length}`);

  // ── CONTENÇÃO — POST /service-orders direto continua 403 (companion) ──
  {
    const app = Fastify();
    app.decorateRequest('tenant', null);
    app.decorateRequest('user', null);
    app.decorateRequest('actionContext', null);
    await app.register(serviceOrderRoutes);
    await app.ready();
    const res = await app.inject({
      method: 'POST', url: '/service-orders',
      payload: { serviceId: service.serviceId, workerActorId: operator.actorId, customerActorId: consumer.actorId, serviceOfferingId: offering.id },
    });
    let code: string | undefined;
    try { code = JSON.parse(res.body)?.code; } catch { /* noop */ }
    await app.close();
    record('J POST /service-orders direto continua 403 SERVICE_ORDER_DIRECT_CREATE_DISABLED',
      res.statusCode === 403 && code === 'SERVICE_ORDER_DIRECT_CREATE_DISABLED', `status=${res.statusCode} code=${code}`);
  }

  // ── FINANCEIRO — Δbank=0 (ledger/transactions/splits/accounts) ──
  const bankAfter = await count(
    `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`
  );
  record('K Δbank=0 (bank_ledger+bank_transactions+bank_splits+bank_accounts inalterados)', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

  // ── FLAGS financeiras off / workers off (não setadas pelo orquestrador) ──
  const flagOn = (v: string | undefined): boolean => v === 'true' || v === '1';
  const financeFlagsOff =
    !flagOn(process.env.SERVICE_FINANCIAL_RUNTIME_ENABLED) &&
    !flagOn(process.env.CHECKOUT_FINANCIAL_RUNTIME_ENABLED) &&
    !Object.keys(process.env).some((k) => /^ENABLE_.*WORKER$/.test(k) && flagOn(process.env[k]));
  record('L flags financeiras OFF + nenhum ENABLE_*_WORKER ligado', financeFlagsOff,
    `SFRE=${process.env.SERVICE_FINANCIAL_RUNTIME_ENABLED ?? 'unset'} CFRE=${process.env.CHECKOUT_FINANCIAL_RUNTIME_ENABLED ?? 'unset'}`);

  // ── S — exatamente 1 service_order (caminho canônico) ──
  record('S exatamente 1 service_order no total (caminho canônico único)', (await count(`SELECT count(*)::int AS n FROM service_orders`)) === 1);

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
  console.log('✨ MVP service journey (money-free) fecha ponta-a-ponta via writers canônicos; Δbank=0; atendimento mínimo provado.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
