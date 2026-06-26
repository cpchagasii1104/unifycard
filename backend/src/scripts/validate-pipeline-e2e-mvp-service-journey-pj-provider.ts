/**
 * E2E F-MVP-SERVICE-JOURNEY-PJ-PROVIDER — FASE 2 MATERIAL CONTIDA (money-free, actor-first, PJ/page-actor).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-mvp-service-journey-pj-provider-ephemeral.ps1 (cria DB, migra FULL, roda, DROPA).
 *
 * Espelha a espinha já selada para PF (commit f83e8584), agora com provider PJ/page-actor — provando que a
 * MESMA coluna vertebral suporta empresa como prestadora, via writers canônicos, sem dinheiro:
 *
 *   empresa nasce (fiscal-first, KYB approved) → page-actor (operador da empresa) → autoridade do owner
 *   (company_users owner/can_manage → canRepresentActor do page-actor) → ATIVAÇÃO OPERACIONAL canônica
 *   (primary_company_type_id + primary_concept_id) → PUBLICAÇÃO canônica do concept (status='active') →
 *   canonical_service ACTIVE → service (provider=page-actor; herda elegibilidade PJ da publicação) →
 *   offering DRAFT → ATIVAÇÃO via GATE PJ REAL (publicação + empresa operacional + KYB approved — NÃO bypass)
 *   → availability (owner='service_offering') → booking requested (consumidor) → decision ACCEPTED
 *   (page-actor, dono soberano) → service_order via confirmBookingFromDecision (settlement_flow='none')
 *   → my-orders (consumidor) + service-orders worker view (empresa/page-actor) → atendimento mínimo (inbox AUTO-EMITIDO, sem test-only).
 *
 * Actor-first: consumidor é actor_type='user'; o operador da empresa é o PAGE-ACTOR (actor da empresa), e a
 * autoridade do humano sobre ele deriva de company_users (membership owner), NUNCA de referral/user_id/actorId-do-cliente.
 * Semântica: UM concept_id (seedado, governado, ∈ company_type_allowed_concepts) atravessa ativação → publicação →
 * canonical_service → declaração-via-publicação → gate de ativação da offering. CNAE/company_type sugere, não autoriza.
 * TEMPO: availability/bookings (zero schedules/schedule_slots). FINANCEIRO: settlement_flow='none'; Δbank=0; flags off.
 * POST /service-orders direto continua 403. CRM/evidence/invoicing FORA; inbox AUTO-EMITIDO (money/CRM-free). Dinheiro HOLD.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { ensureUserActor, ensurePageActor } from '../modules/identity/actor-writer.service';
import { companiesService } from '../core/companies/companies.service';
import { companyPublicationsService } from '../core/companies/company-publications.service';
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
  if (!/mvp|pj|provider|service|journey|seed|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

let seq = 0;

/** ACTOR humano por caminho canônico (ensureUserActor §4.8); substrato civil test-only (sem register HTTP). */
async function seedCivilActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const cpf = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, cpf, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, cpf]);
  await pool.query(
    `INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at)
       VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`,
    [userId, tenantId, `${name.toLowerCase()}-${seq}@e2e.test`, gu]
  );
  const actor = await ensureUserActor(tenantId, userId);
  return { userId, actorId: actor.actor_id, globalUserId: gu };
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
  await tenantService.createTenant({ id: TENANT_ID, name: 'MVP PJ Provider Journey', slug: `mpjp-${Date.now()}` });

  // ── SEMÂNTICA + SEGMENTO: triple COERENTE do catálogo seedado (sem hardcode de UUID) ──
  // company_type que tem (a) concept permitido [ativação/publicação] E (b) categoria de serviço servicos na
  // ponte de ramos [createService PJ — DECISION-0109]. concept_id = eixo semântico; categoria = eixo de ramo.
  const triple = (await pool.query<{ company_type_id: string; service_category_id: string; concept_id: string }>(
    `SELECT ctsc.company_type_id::text AS company_type_id,
            ctsc.service_category_id::text AS service_category_id,
            ctac.concept_id::text AS concept_id
       FROM company_type_service_categories ctsc
       JOIN company_type_allowed_concepts ctac ON ctac.company_type_id = ctsc.company_type_id
       JOIN categories cat ON cat.category_id = ctsc.service_category_id
      WHERE cat.metadata->>'domain' = 'servicos'
      ORDER BY ctsc.company_type_id, ctac.concept_id
      LIMIT 1`
  )).rows[0];
  if (!triple) throw new Error('catálogo FULL não forneceu triple (company_type × concept permitido × categoria servicos na ponte).');
  const { company_type_id: companyTypeId, service_category_id: serviceCategoryId, concept_id: conceptId } = triple;
  record('A0 triple canônico do catálogo (company_type × concept permitido × categoria servicos na ponte)',
    !!companyTypeId && !!conceptId && !!serviceCategoryId, `type=${companyTypeId} concept=${conceptId} cat=${serviceCategoryId}`);

  // ── IDENTIDADE/ACTOR: owner humano (operará a empresa) + consumidor ──
  const owner = await seedCivilActor(TENANT_ID, 'OwnerHumano');
  const consumer = await seedCivilActor(TENANT_ID, 'CarolConsumidor');
  record('A consumidor + owner humano criados pelo caminho canônico (ensureUserActor)', !!owner.actorId && !!consumer.actorId);

  const bankBefore = await count(
    `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`
  );

  // ── G1 — NASCIMENTO PJ: fiscal-first KYB approved + company + page-actor + membership owner ──
  // fiscal_identities KYB='approved' seedado test-only (a cadeia canônica de review documental é HTTP/admin,
  // fora do escopo do SERVICE journey) — padrão já usado por pj-kyb-gate/pj-publication-writer; DB efêmera.
  const cnpj = String(Date.now() + (seq += 1)).padStart(14, '0').slice(-14);
  const fiscalId = (await pool.query<{ f: string }>(
    `INSERT INTO fiscal_identities (cnpj, kyb_status, reviewed_by_actor_id, reviewed_at) VALUES ($1,'approved',$2::uuid, now()) RETURNING fiscal_identity_id::text AS f`,
    [cnpj, owner.actorId]
  )).rows[0].f;
  const companyId = (await pool.query<{ c: string }>(
    `INSERT INTO companies (tenant_id, company_name, fiscal_identity_id) VALUES ($1::uuid,$2,$3::uuid) RETURNING company_id::text AS c`,
    [TENANT_ID, 'MVP PJ Provider LTDA', fiscalId]
  )).rows[0].c;
  const pageActor = await ensurePageActor(TENANT_ID, companyId, owner.actorId); // WRITER CANÔNICO de page-actor (§4.8)
  // Registro canônico do page-actor → entidade 'companies' (o que o nascimento atômico real faz): habilita a
  // autoridade institucional 'ownership de entidade' em canActAs (manage_bookings = ownership suficiente, sem capability).
  const { actorRegistryService } = await import('../core/actor-registry/actor-registry.service');
  await actorRegistryService.register(TENANT_ID, pageActor.actor_id, 'company', 'companies', companyId);
  await pool.query(
    `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active, member_status)
       VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true,true,'active')`,
    [TENANT_ID, companyId, owner.globalUserId]
  );
  record('G1 empresa nasce fiscal-first KYB approved + page-actor + membership owner',
    !!fiscalId && !!companyId && !!pageActor.actor_id && pageActor.company_id === companyId,
    `company=${companyId} page=${pageActor.actor_id}`);

  // ── G2 — AUTORIDADE: owner representa o page-actor por caminho canônico (company_users), não por referral/actorId ──
  const { authorizationService } = await import('../core/authorization/authorization.service');
  const canRep = await authorizationService.canRepresentActor(TENANT_ID, owner.userId, pageActor.actor_id);
  record('G2 owner representa o page-actor via canRepresentActor (company membership; não referral/user_id/actorId-cliente)',
    canRep === true, `canRep=${canRep}`);

  // ── ATIVAÇÃO OPERACIONAL canônica (primary_company_type_id + primary_concept_id) ──
  await companiesService.activateCompanyOperationally({
    tenantId: TENANT_ID,
    companyId,
    responsibleUserId: owner.userId,
    primaryCompanyTypeId: companyTypeId,
    primaryConceptId: conceptId,
  });
  const opRow = (await pool.query<{ t: string | null }>(`SELECT primary_company_type_id::text AS t FROM companies WHERE company_id=$1`, [companyId])).rows[0];
  record('G1b empresa OPERACIONAL via writer canônico (primary_company_type_id setado)', opRow?.t === companyTypeId, `type=${opRow?.t}`);

  // ── G3 — PUBLICAÇÃO canônica do concept (status='active'; KYB-gated) ──
  await companyPublicationsService.publishCompanyConcept({
    tenantId: TENANT_ID,
    companyId,
    responsibleUserId: owner.userId,
    globalUserId: owner.globalUserId,
    conceptId,
  });
  const pubActive = await count(
    `SELECT count(*)::int AS n FROM company_concept_publications WHERE tenant_id=$1 AND company_id=$2 AND concept_id=$3 AND status='active'`,
    [TENANT_ID, companyId, conceptId]
  );
  record('G3 company_concept_publications.status=active (writer canônico; KYB-gated; concept_id consistente)', pubActive === 1, `n=${pubActive}`);

  // ── canonical_service ACTIVE p/ o concept (concept seedado/governado — sem INSERT em concepts) ──
  const canonicalId = randomUUID();
  await pool.query(
    `INSERT INTO canonical_services (id, tenant_id, scope, concept_id, name, slug, status)
       VALUES ($1::uuid,$2::uuid,'scoped',$3::uuid,$4,$5,'active')`,
    [canonicalId, TENANT_ID, conceptId, 'MVP PJ Canonical', `mvp-pj-canonical-${canonicalId.slice(0, 8)}`]
  );

  // ── G4 — SERVICE (writer canônico; provider=page-actor; herda elegibilidade PJ da publicação) ──
  const service = await servicesService.createService(TENANT_ID, owner.userId, {
    actorId: pageActor.actor_id,
    name: 'MVP PJ Service',
    categoryId: serviceCategoryId,
    canonicalServiceId: canonicalId,
    serviceType: ServiceType.SERVICE,
  });
  record('G4 service criado via writer canônico (provider=page-actor, ramo na ponte do company_type)', !!service.serviceId, `serviceId=${service.serviceId}`);

  // ── offering DRAFT (writer canônico; company_id derivado server-side do page-actor) ──
  const { offering } = await serviceOfferingService.createOffering({
    tenantId: TENANT_ID,
    userId: owner.userId,
    providerActorId: pageActor.actor_id,
    canonicalServiceId: canonicalId,
    priceCents: 8000,
    durationMinutes: 60,
    modality: 'in_person',
  });
  record('G4b offering nasce DRAFT (criação ≠ ativação)', offering.status === 'draft', `status=${offering.status}`);

  // ── G3b — ATIVAÇÃO via GATE PJ REAL (publicação + empresa operacional + KYB approved). NÃO bypass. ──
  await serviceOfferingService.updateOwnOffering({ tenantId: TENANT_ID, userId: owner.userId, offeringId: offering.id, status: 'active' });
  const offActive = await serviceOfferingService.findById(TENANT_ID, offering.id);
  record('G3b offering ATIVADO via GATE PJ canônico (publicação+operacional+KYB; sem bypass)', offActive?.status === 'active', `status=${offActive?.status}`);

  // ── G5 — TEMPO: availability (owner='service_offering') ──
  const avail = await serviceOfferingService.declareAvailability({
    tenantId: TENANT_ID,
    userId: owner.userId,
    offeringId: offering.id,
    startDatetime: '2026-12-01T09:00:00Z',
    endDatetime: '2026-12-01T10:00:00Z',
    capacity: 1,
  });
  const avRow = (await pool.query<{ owner_type: string; owner_id: string }>(
    `SELECT owner_type, owner_id::text AS owner_id FROM availability WHERE availability_id=$1`, [avail.availabilityId]
  )).rows[0];
  record('G5 availability owner=service_offering (SSOT temporal físico)', avRow?.owner_type === 'service_offering' && avRow?.owner_id === offering.id, JSON.stringify(avRow));
  const ghostSchedules = await count(`SELECT (SELECT count(*) FROM schedules)::int AS n`).catch(() => 0);
  record('G5b zero schedules/schedule_slots (SSOT temporal = availability, não legado C63)', ghostSchedules === 0, `schedules=${ghostSchedules}`);

  // ── booking 'requested' pelo CONSUMIDOR (re-checa offering active) ──
  const booking = await unifiedAvailabilityService.createBooking(
    TENANT_ID,
    { subjectUserId: consumer.userId, requesterActorId: consumer.actorId },
    { availabilityId: avail.availabilityId, requesterActorId: consumer.actorId, metadata: { serviceId: service.serviceId } } as any
  );
  record('G5c booking nasce requested (consumidor; modo CONSUMO)', booking.status === 'requested', `status=${booking.status}`);

  // ── decision ACCEPTED pelo PAGE-ACTOR (dono soberano da oferta; owner representa) ──
  const decision = await serviceBookingDecisionService.createDecision(TENANT_ID, owner.userId, {
    bookingId: booking.bookingId,
    decidedByActorId: pageActor.actor_id,
    status: BookingDecisionStatus.ACCEPTED,
  });
  record('G6 decision ACCEPTED pelo page-actor (dono soberano; modo OPERAÇÃO da empresa)', !!decision.decisionId, `decisionId=${decision.decisionId}`);

  // ── G6b — service_order via confirmBookingFromDecision (worker=page-actor, customer=consumidor; settlement='none') ──
  const order = await serviceOrderService.confirmBookingFromDecision(TENANT_ID, booking.bookingId, decision.decisionId, pageActor.actor_id, owner.userId);
  record('G6b service_order via confirmBookingFromDecision (worker=page-actor, customer=consumidor)',
    order.workerActorId === pageActor.actor_id && order.customerActorId === consumer.actorId,
    `worker=${order.workerActorId} customer=${order.customerActorId}`);
  const soRow = (await pool.query<{ sf: string; so: string | null }>(
    `SELECT settlement_flow AS sf, service_offering_id::text AS so FROM service_orders WHERE id=$1`, [order.id]
  )).rows[0];
  record('G6c service_order.settlement_flow="none" (money-free)', soRow?.sf === 'none', `settlement_flow=${soRow?.sf}`);
  record('G6d service_order grava a oferta canônica (service_offering_id da availability)', soRow?.so === offering.id, `so=${soRow?.so} esperado=${offering.id}`);

  // ── G7 — VISIBILIDADE: consumidor (customer view) + empresa/page-actor (worker view) ──
  const consumerOrders = await serviceOrderRepository.listOrders(TENANT_ID, { customerActorId: consumer.actorId, limit: 1000 });
  record('G7 my-orders (read-model canônico, customer view) retorna a ordem para o CONSUMIDOR', consumerOrders.some((o) => o.id === order.id), `itens=${consumerOrders.length}`);
  const companyOrders = await serviceOrderRepository.listOrders(TENANT_ID, { workerActorId: pageActor.actor_id, limit: 1000 });
  record('G7b service-orders worker view retorna a ordem para a EMPRESA/page-actor', companyOrders.some((o) => o.id === order.id), `itens=${companyOrders.length}`);

  // ── atendimento mínimo: inbox AUTO-EMITIDO no nascimento da service_order p/ o page-actor (F-SERVICE-ORDER-INBOX-AUTO-EMIT) ──
  // SEM insert test-only: o item nasce DENTRO de confirmBookingFromDecision (read-model do provider/worker = empresa/page-actor).
  const inbox = await socialInboxService.getInboxItems(TENANT_ID, pageActor.actor_id);
  const orderItem = inbox.find((i) => i.sourceId === order.id && i.sourceType === InboxSourceType.ORDER);
  record('G7c atendimento mínimo: inbox AUTO-EMITIDO (sourceType=ORDER, sourceId=order.id) para o page-actor',
    !!orderItem, `itens=${inbox.length} effect=${orderItem?.metadata?.effectType}`);
  record('G7d inbox auto-emitido é canônico (effectType=SERVICE_ORDER_CONFIRMED, NÃO e2e-test-only)',
    !!orderItem && orderItem.metadata?.effectType === 'SERVICE_ORDER_CONFIRMED' && orderItem.metadata?.origin !== 'e2e-test-only');
  // Idempotência por referência: reprojetar o MESMO nascimento NÃO duplica (ON CONFLICT actor_id+source_type+source_id).
  const { socialInboxProjector } = await import('../modules/inbox/social-inbox.projector');
  await socialInboxProjector.projectServiceOrderConfirmed(TENANT_ID, { serviceOrderId: order.id, providerActorId: pageActor.actor_id, bookingId: booking.bookingId, decisionId: decision.decisionId, serviceId: service.serviceId });
  const inboxAfter = await socialInboxService.getInboxItems(TENANT_ID, pageActor.actor_id);
  const orderItems = inboxAfter.filter((i) => i.sourceId === order.id && i.sourceType === InboxSourceType.ORDER);
  record('G7e idempotência: reprojetar o mesmo service_order NÃO duplica inbox (exatamente 1 item ORDER)', orderItems.length === 1, `itens_order=${orderItems.length}`);

  // ── CONTENÇÃO — POST /service-orders direto continua 403 ──
  {
    const app = Fastify();
    app.decorateRequest('tenant', null);
    app.decorateRequest('user', null);
    app.decorateRequest('actionContext', null);
    await app.register(serviceOrderRoutes);
    await app.ready();
    const res = await app.inject({
      method: 'POST', url: '/service-orders',
      payload: { serviceId: service.serviceId, workerActorId: pageActor.actor_id, customerActorId: consumer.actorId, serviceOfferingId: offering.id },
    });
    let code: string | undefined;
    try { code = JSON.parse(res.body)?.code; } catch { /* noop */ }
    await app.close();
    record('J POST /service-orders direto continua 403 SERVICE_ORDER_DIRECT_CREATE_DISABLED',
      res.statusCode === 403 && code === 'SERVICE_ORDER_DIRECT_CREATE_DISABLED', `status=${res.statusCode} code=${code}`);
  }

  // ── G8 — FINANCEIRO: Δbank=0 + flags/workers off ──
  const bankAfter = await count(
    `SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_splits)+(SELECT count(*) FROM bank_accounts))::int AS n`
  );
  record('G8 Δbank=0 (bank_ledger+bank_transactions+bank_splits+bank_accounts inalterados)', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);
  const flagOn = (v: string | undefined): boolean => v === 'true' || v === '1';
  const financeFlagsOff =
    !flagOn(process.env.SERVICE_FINANCIAL_RUNTIME_ENABLED) &&
    !flagOn(process.env.CHECKOUT_FINANCIAL_RUNTIME_ENABLED) &&
    !Object.keys(process.env).some((k) => /^ENABLE_.*WORKER$/.test(k) && flagOn(process.env[k]));
  record('G8b flags financeiras OFF + nenhum ENABLE_*_WORKER ligado', financeFlagsOff,
    `SFRE=${process.env.SERVICE_FINANCIAL_RUNTIME_ENABLED ?? 'unset'} CFRE=${process.env.CHECKOUT_FINANCIAL_RUNTIME_ENABLED ?? 'unset'}`);

  // ── S — exatamente 1 service_order (caminho canônico único) ──
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
  console.log('✨ MVP service journey PJ provider (money-free) fecha ponta-a-ponta via writers canônicos; autoridade da empresa provada; Δbank=0.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
