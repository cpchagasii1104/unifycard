// service-offering.service.ts
// DECISION-0117 D (CP4) — OFERTA de serviço canônico por prestador.
//
// O significado/identidade vive em canonical_services (compartilhado); a oferta
// guarda só o que é do PRESTADOR: price_cents BIGINT, duração EFETIVA,
// profissional executor, modalidade, localização/área, condições, status.
// Disponibilidade = Unified Availability (owner = ('service_offering', id)) —
// NENHUM calendário paralelo. Booking transacional/pagamento FORA (0109/0117).
// Autoridade: canRepresentActor(provider) server-side. Zero Bank writer.

import { pool, runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { authorizationService } from '@core/authorization/authorization.service';
import { canonicalServiceService } from '@core/catalog/canonical/canonical-service.service';
import { unifiedAvailabilityService } from '@core/availability/unified-availability.service';
import { AvailabilityOwnerType, UnifiedBookingStatus, type UnifiedAvailability } from '@core/availability/unified-availability.types';
import { assertOfferingActivationEligibility } from './services-offering-activation-gate';
// 🔴 F-PERFORMER-CONTRACTING-POLICY / DECISION-0030 — REUSA o primitivo geo CANÔNICO do feed/rentals/marketplace
// (actor_active_location = SSOT de localização do actor + a SQL fn haversine_distance_km). NÃO cria caminho geo
// paralelo (§2 sem realidade paralela). O uso de haversine_distance_km em módulo operacional CRUZA a ressalva
// anti-padrão #1 da DECISION-0030 amparado no PRECEDENTE já SELADO de rentals/feed-proximity (mesmo par de primitivos).
import { actorActiveLocationRepository } from '@core/location/actor-active-location.repository';

export class ServiceOfferingError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'ServiceOfferingError';
  }
}

// 🔴 C1c-a — valida a CAPACIDADE DO EQUIPAMENTO/som próprio (conditions.audience_capacity): se presente, inteiro > 0.
// SEMÂNTICA: alcance do EQUIPAMENTO/PA ("meu som atende até N pessoas") — insumo LOGÍSTICO da orquestração de
// locação de equipamento. ≠ FAIXA DE PÚBLICO PREFERIDA (audience_min/audience_max, colunas REAIS): esta é
// PREFERÊNCIA/CONFORTO da banda que alimenta os FILTROS de descoberta. Dois eixos DISTINTOS (§2 sem verdade
// duplicada), mantidos separados. ≠ capacity de SLOT da Unified Availability (vagas de agenda). Ausente = ok
// (atributo opcional). Só shape; sem coluna nova. COMMENT-ONLY: validação/comportamento INTOCADOS.
function assertAudienceCapacity(conditions?: Record<string, unknown> | null): void {
  if (!conditions || conditions.audience_capacity === undefined || conditions.audience_capacity === null) return;
  const cap = conditions.audience_capacity;
  if (!Number.isInteger(cap) || (cap as number) <= 0) {
    throw new ServiceOfferingError(400, 'SERVICE_OFFERING_CAPACITY_INVALID',
      'conditions.audience_capacity deve ser inteiro > 0 (capacidade de público).');
  }
}

export interface ServiceOffering {
  id: string;
  tenantId: string;
  canonicalServiceId: string;
  providerActorId: string;
  companyId: string | null;
  priceCents: number;
  durationMinutes: number;
  professionalActorId: string | null;
  modality: string;
  status: string;
  // 🔴 F-PERFORMER-CONTRACTING-POLICY — política de contratação (colunas REAIS, CHECK-governed; NÃO conditions
  // JSONB). 'manual'=negocia (fica requested), 'automatic'=aceita-direto (auto-confirma dentro da distância).
  // Condição = DISTÂNCIA: mesma-cidade OU raio(km). PREÇO fora desta fatia. Δbank=0.
  bookingApprovalMode: 'manual' | 'automatic';
  acceptDirectSameCity: boolean;
  acceptDirectRadiusKm: number | null;
  // 🔴 F-PERFORMER-AUDIENCE-RANGE — FAIXA DE PÚBLICO preferida/aceita (colunas REAIS, both-or-neither, min<=max).
  // PREFERÊNCIA/CONFORTO que alimenta a descoberta. DISTINTA de conditions.audience_capacity (alcance do
  // EQUIPAMENTO). NULL/NULL = não declarada. Bank-free (contagem de pessoas). PREÇO/cardápio fora.
  audienceMin: number | null;
  audienceMax: number | null;
}

interface SoRow {
  id: string;
  tenant_id: string;
  canonical_service_id: string;
  provider_actor_id: string;
  company_id: string | null;
  price_cents: string | number;
  duration_minutes: number;
  professional_actor_id: string | null;
  modality: string;
  status: string;
  booking_approval_mode: string;
  accept_direct_same_city: boolean;
  accept_direct_radius_km: string | number | null;
  audience_min: number | null;
  audience_max: number | null;
}

const SO_SELECT =
  'id, tenant_id, canonical_service_id, provider_actor_id, company_id, price_cents, ' +
  'duration_minutes, professional_actor_id, modality, status, ' +
  'booking_approval_mode, accept_direct_same_city, accept_direct_radius_km, ' +
  'audience_min, audience_max';

function toOffering(row: SoRow): ServiceOffering {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    canonicalServiceId: row.canonical_service_id,
    providerActorId: row.provider_actor_id,
    companyId: row.company_id,
    priceCents: Number(row.price_cents),
    durationMinutes: row.duration_minutes,
    professionalActorId: row.professional_actor_id,
    modality: row.modality,
    status: row.status,
    bookingApprovalMode: (row.booking_approval_mode === 'automatic' ? 'automatic' : 'manual'),
    acceptDirectSameCity: row.accept_direct_same_city === true,
    acceptDirectRadiusKm: row.accept_direct_radius_km === null ? null : Number(row.accept_direct_radius_km),
    audienceMin: row.audience_min === null ? null : Number(row.audience_min),
    audienceMax: row.audience_max === null ? null : Number(row.audience_max),
  };
}

// 🔴 F-PERFORMER-CONTRACTING-POLICY — validação-antes-de-escrever (§4.9.5) do trio de política. Espelha o
// CHECK físico do banco (automatic-exige-distância) na fronteira do writer, para rejeição controlada (400) em vez
// de erro cru de constraint. Vocabulário GOVERNADO por CHECK — NÃO inventa enum type. Reusável por create/update.
interface ContractingPolicyInput {
  bookingApprovalMode?: 'manual' | 'automatic' | null;
  acceptDirectSameCity?: boolean | null;
  acceptDirectRadiusKm?: number | null;
}
function assertContractingPolicy(p: ContractingPolicyInput): void {
  if (p.bookingApprovalMode != null && p.bookingApprovalMode !== 'manual' && p.bookingApprovalMode !== 'automatic') {
    throw new ServiceOfferingError(400, 'SERVICE_OFFERING_APPROVAL_MODE_INVALID',
      "booking_approval_mode deve ser 'manual' (negocia) ou 'automatic' (aceita-direto).");
  }
  if (p.acceptDirectRadiusKm != null && !(Number.isFinite(p.acceptDirectRadiusKm) && (p.acceptDirectRadiusKm as number) > 0)) {
    throw new ServiceOfferingError(400, 'SERVICE_OFFERING_RADIUS_INVALID',
      'accept_direct_radius_km deve ser número > 0 (ou ausente).');
  }
  // automatic EXIGE condição de alcance (espelho do CHECK físico chk_service_offering_automatic_requires_distance).
  if (p.bookingApprovalMode === 'automatic' && p.acceptDirectSameCity !== true && p.acceptDirectRadiusKm == null) {
    throw new ServiceOfferingError(400, 'SERVICE_OFFERING_AUTOMATIC_REQUIRES_DISTANCE',
      "aceita-direto ('automatic') exige condição de distância: same_city=true OU radius_km definido (sem prova de alcance não há auto-confirmação).");
  }
}

// 🔴 F-PERFORMER-AUDIENCE-RANGE — validação-antes-de-escrever (§4.9.5) da FAIXA DE PÚBLICO preferida
// (audience_min/audience_max). Espelha os CHECKs físicos (>0 + min<=max) e a regra both-or-neither (uma faixa
// precisa dos DOIS extremos) na fronteira do writer, para rejeição controlada (400) em vez de erro cru de
// constraint. Colunas REAIS GOVERNADAS por CHECK — NÃO enum type. DISTINTA de audience_capacity (equipamento):
// esta é PREFERÊNCIA que alimenta a descoberta. Reusável por create/update (valores EFETIVOS no update).
interface AudienceRangeInput {
  audienceMin?: number | null;
  audienceMax?: number | null;
}
function assertAudienceRange(p: AudienceRangeInput): void {
  const hasMin = p.audienceMin != null;
  const hasMax = p.audienceMax != null;
  // both-or-neither: declarar um extremo exige o outro (uma faixa precisa dos dois lados).
  if (hasMin !== hasMax) {
    throw new ServiceOfferingError(400, 'SERVICE_OFFERING_AUDIENCE_RANGE_INCOMPLETE',
      'faixa de público exige AMBOS audience_min e audience_max (both-or-neither): uma faixa precisa dos dois extremos.');
  }
  if (!hasMin && !hasMax) return; // ausente = ok (atributo opcional)
  if (!Number.isInteger(p.audienceMin) || (p.audienceMin as number) <= 0) {
    throw new ServiceOfferingError(400, 'SERVICE_OFFERING_AUDIENCE_MIN_INVALID',
      'audience_min deve ser inteiro > 0 (contagem de pessoas).');
  }
  if (!Number.isInteger(p.audienceMax) || (p.audienceMax as number) <= 0) {
    throw new ServiceOfferingError(400, 'SERVICE_OFFERING_AUDIENCE_MAX_INVALID',
      'audience_max deve ser inteiro > 0 (contagem de pessoas).');
  }
  // faixa bem-formada: espelho do CHECK físico chk_service_offering_audience_range.
  if ((p.audienceMin as number) > (p.audienceMax as number)) {
    throw new ServiceOfferingError(400, 'SERVICE_OFFERING_AUDIENCE_RANGE_INVALID',
      'audience_min não pode ser maior que audience_max (faixa mal-formada).');
  }
}

// 🔴 C3 EDGE C-1 — AUTORIDADE DE CONTEXTO DE EVENTO no PROPOSE. O contratante pode amarrar a reserva a um
// evento SEU (metadata.eventId). Vincular um performer ao elenco é ADMINISTRAR staff do evento, então a
// decisão é EXATAMENTE a mesma do POST /events/:id/v2/commitments: manage_attendees sobre o DONO do evento.
// Reusa os PRIMITIVOS SELADOS (eventService.getEvent + authorizationService.canActAs) — não forka a decisão
// (a função-wrapper assertEventExactAuthority é privada de event.routes; a decisão MATERIAL é canActAs). O
// evento é carregado server-side (o eventId do body NUNCA é prova): inexistente → 404; sem a chave → 403.
// ⚠️ 2026-08-05 — A DECISÃO SAIU DAQUI, o comportamento NÃO mudou. Quando o caminho de LOCAÇÃO
// passou a aceitar contexto de evento (o campo era descartado em silêncio), escrever a mesma
// checagem lá teria criado DUAS regras para "posso amarrar a este evento?". A decisão material
// mora agora em `@core/events/event-context-authority` e os dois writers passam por ela; este
// wrapper só traduz o erro neutro para o envelope desta superfície, preservando os códigos que
// os consumidores já conhecem.
async function assertEventContractingAuthority(tenantId: string, userId: string, eventId: string): Promise<void> {
  const { assertEventContextAuthority, EventContextAuthorityError } =
    await import('@core/events/event-context-authority');
  try {
    await assertEventContextAuthority(tenantId, userId, eventId);
  } catch (e) {
    if (e instanceof EventContextAuthorityError) {
      throw e.statusCode === 404
        ? new ServiceOfferingError(404, 'SERVICE_OFFERING_EVENT_NOT_FOUND', e.message)
        : new ServiceOfferingError(403, 'SERVICE_OFFERING_EVENT_NOT_MANAGEABLE', e.message);
    }
    throw e;
  }
}

// 🔴 C3 EDGE C-1 — validação SOFT do configId (metadata-only). Se informado, o config DEVE pertencer a ESTA
// oferta (sem FK dura, sem tocar o gate de soft-retire do config). config de OUTRA oferta → rejeita no propose.
async function assertConfigBelongsToOffering(tenantId: string, offeringId: string, configId: string): Promise<void> {
  const rows = await runQueriesWithTenant<{ id: string }>(
    tenantId,
    `SELECT id::text AS id FROM service_offering_configs
      WHERE id = $1::uuid AND service_offering_id = $2::uuid AND tenant_id = $3::uuid
      LIMIT 1`,
    [configId, offeringId, tenantId]
  );
  if (rows.length === 0) {
    throw new ServiceOfferingError(422, 'SERVICE_OFFERING_CONFIG_MISMATCH',
      'configId não pertence a esta oferta (metadata-only; sem FK dura).');
  }
}

export const serviceOfferingService = {
  async findById(tenantId: string, offeringId: string): Promise<ServiceOffering | null> {
    const r = await pool.query<SoRow>(
      `SELECT ${SO_SELECT} FROM service_offerings WHERE id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
      [offeringId, tenantId]
    );
    return r.rows[0] ? toOffering(r.rows[0]) : null;
  },

  /**
   * Cria a oferta do prestador para um serviço canônico ATIVO (curado).
   * Idempotente por (provider, canonical_service) — UNIQUE; segunda chamada
   * devolve a existente. NÃO duplica significado.
   */
  async createOffering(input: {
    tenantId: string;
    userId: string;
    providerActorId: string;
    canonicalServiceId: string;
    companyId?: string | null;
    priceCents: number;
    durationMinutes: number;
    professionalActorId?: string | null;
    modality?: 'in_person' | 'remote' | 'home';
    location?: Record<string, unknown> | null;
    serviceArea?: Record<string, unknown> | null;
    conditions?: Record<string, unknown> | null;
    bookingApprovalMode?: 'manual' | 'automatic' | null;
    acceptDirectSameCity?: boolean | null;
    acceptDirectRadiusKm?: number | null;
    audienceMin?: number | null;
    audienceMax?: number | null;
  }): Promise<{ offering: ServiceOffering; created: boolean }> {
    const canRep = await authorizationService.canRepresentActor(input.tenantId, input.userId, input.providerActorId);
    if (!canRep) {
      throw new ServiceOfferingError(403, 'SERVICE_OFFERING_NOT_REPRESENTABLE',
        'Sem autoridade para representar o actor prestador (DECISION-0113).');
    }
    if (!Number.isInteger(input.priceCents) || input.priceCents < 0) {
      throw new ServiceOfferingError(400, 'SERVICE_OFFERING_PRICE_INVALID', 'priceCents inteiro ≥ 0.');
    }
    if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0) {
      throw new ServiceOfferingError(400, 'SERVICE_OFFERING_DURATION_INVALID', 'durationMinutes inteiro > 0.');
    }
    // 🔴 F-PERFORMER-CONTRACTING-POLICY — valida o trio de política ANTES de escrever (§4.9.5).
    assertContractingPolicy(input);
    // 🔴 F-PERFORMER-AUDIENCE-RANGE — valida a FAIXA DE PÚBLICO preferida ANTES de escrever (§4.9.5): both-or-neither,
    // int>0, min<=max. DISTINTA de audience_capacity (equipamento). Ausente = ok.
    assertAudienceRange(input);
    // 🔴 C1c-a — CAPACIDADE DE PÚBLICO: atributo OPCIONAL em conditions.audience_capacity (int > 0). É
    // "atende até N pessoas" (público do show) — SEMÂNTICA DISTINTA do `capacity` de SLOT da Unified
    // Availability (vagas de agenda). Só validação de shape; sem coluna nova. Fail-closed no writer de conditions.
    assertAudienceCapacity(input.conditions);

    // Identidade compartilhada ATIVA (redirect resolvido; fail-closed).
    const canonical = await canonicalServiceService.requireActiveForTenant(input.tenantId, input.canonicalServiceId);

    // 🔴 F-OFFER-3 / DECISION-0145: a oferta PERTENCE a um `service` VÁLIDO do MESMO provider + MESMO concept
    // (resolvido via canonical). O `service` já carrega a elegibilidade da DECISION-0144 (declaração PF /
    // publicação PJ ACTIVE) — HERDADA aqui, NÃO duplicada (single-chain CONCEPT→SERVICE→SERVICE_OFFERING).
    const svc = await pool.query<{ service_id: string }>(
      `SELECT service_id FROM services
        WHERE tenant_id = $1::uuid AND actor_id = $2::uuid AND canonical_service_id = $3::uuid`,
      [input.tenantId, input.providerActorId, canonical.id]
    );
    if (svc.rows.length === 0) {
      throw new ServiceOfferingError(403, 'SERVICE_OFFERING_REQUIRES_SERVICE',
        'A oferta exige um service do mesmo provider para este concept (DECISION-0145); crie o service antes — ele valida a declaração/publicação (DECISION-0144).');
    }
    if (svc.rows.length > 1) {
      throw new ServiceOfferingError(409, 'SERVICE_OFFERING_SERVICE_AMBIGUOUS',
        'Mais de um service do provider para este canonical: vínculo service→offering ambíguo (DECISION-0145 §B-bis G5).');
    }
    const serviceId = svc.rows[0].service_id;

    // company_id DERIVADO server-side do provider (D-F3-2 / G4): body NUNCA define company/owner.
    // 🔴 F-RLS-TENANT-CONTEXT: actors tem RLS+FORCE — tenant-context obrigatório.
    const provRow = await runQueryWithTenant<{ company_id: string | null }>(
      input.tenantId,
      `SELECT company_id FROM actors WHERE id = $1::uuid LIMIT 1`,
      [input.providerActorId]
    );
    const derivedCompanyId = provRow?.company_id ?? null;

    const existing = await pool.query<SoRow>(
      `SELECT ${SO_SELECT} FROM service_offerings
        WHERE provider_actor_id = $1::uuid AND canonical_service_id = $2::uuid LIMIT 1`,
      [input.providerActorId, canonical.id]
    );
    if (existing.rows[0]) return { offering: toOffering(existing.rows[0]), created: false };

    // status nasce 'draft' (D-F3-3): criação ≠ ativação pública. professional_actor_id do body NÃO carimba (G4) → null.
    const ins = await pool.query<SoRow>(
      `INSERT INTO service_offerings (
         tenant_id, canonical_service_id, service_id, provider_actor_id, company_id,
         price_cents, duration_minutes, professional_actor_id, modality,
         location, service_area, conditions, status,
         booking_approval_mode, accept_direct_same_city, accept_direct_radius_km,
         audience_min, audience_max
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, 'draft',
                 $13, $14, $15, $16, $17)
       RETURNING ${SO_SELECT}`,
      [
        input.tenantId, canonical.id, serviceId, input.providerActorId, derivedCompanyId,
        input.priceCents, input.durationMinutes, null,
        input.modality ?? 'in_person',
        JSON.stringify(input.location ?? {}), JSON.stringify(input.serviceArea ?? {}),
        JSON.stringify(input.conditions ?? {}),
        input.bookingApprovalMode ?? 'manual',
        input.acceptDirectSameCity ?? false,
        input.acceptDirectRadiusKm ?? null,
        input.audienceMin ?? null,
        input.audienceMax ?? null,
      ]
    );
    return { offering: toOffering(ins.rows[0]), created: true };
  },

  /** Atualiza/suspende a PRÓPRIA oferta. Cross-provider → 403. */
  async updateOwnOffering(input: {
    tenantId: string;
    userId: string;
    offeringId: string;
    priceCents?: number | null;
    durationMinutes?: number | null;
    status?: 'draft' | 'active' | 'suspended' | null;
    bookingApprovalMode?: 'manual' | 'automatic' | null;
    acceptDirectSameCity?: boolean | null;
    acceptDirectRadiusKm?: number | null;
    audienceMin?: number | null;
    audienceMax?: number | null;
  }): Promise<void> {
    const offering = await this.findById(input.tenantId, input.offeringId);
    if (!offering) throw new ServiceOfferingError(404, 'SERVICE_OFFERING_NOT_FOUND', 'Oferta inexistente.');
    const canRep = await authorizationService.canRepresentActor(input.tenantId, input.userId, offering.providerActorId);
    if (!canRep) {
      throw new ServiceOfferingError(403, 'SERVICE_OFFERING_NOT_REPRESENTABLE',
        'Prestador só altera a própria oferta.');
    }

    // 🔴 F-PERFORMER-CONTRACTING-POLICY — política de contratação: valida os valores EFETIVOS (merge do input com
    // o estado atual) ANTES de escrever (§4.9.5), espelhando o CHECK físico automatic-exige-distância. Um update
    // parcial (só mode='automatic') não pode passar se a linha resultante ficaria sem condição de distância.
    const touchesPolicy =
      input.bookingApprovalMode !== undefined || input.acceptDirectSameCity !== undefined || input.acceptDirectRadiusKm !== undefined;
    if (touchesPolicy) {
      const effMode = (input.bookingApprovalMode ?? offering.bookingApprovalMode) as 'manual' | 'automatic';
      const effSameCity = input.acceptDirectSameCity != null ? input.acceptDirectSameCity : offering.acceptDirectSameCity;
      const effRadius = input.acceptDirectRadiusKm !== undefined ? input.acceptDirectRadiusKm : offering.acceptDirectRadiusKm;
      assertContractingPolicy({ bookingApprovalMode: effMode, acceptDirectSameCity: effSameCity, acceptDirectRadiusKm: effRadius });
    }

    // 🔴 F-PERFORMER-AUDIENCE-RANGE — faixa de público: valida os valores EFETIVOS (merge do input com o estado
    // atual) ANTES de escrever (§4.9.5), espelhando o both-or-neither + CHECK físico min<=max. Um update parcial
    // (só um extremo) não pode deixar a linha resultante com faixa incompleta/mal-formada.
    const touchesAudience = input.audienceMin !== undefined || input.audienceMax !== undefined;
    if (touchesAudience) {
      const effMin = input.audienceMin !== undefined ? input.audienceMin : offering.audienceMin;
      const effMax = input.audienceMax !== undefined ? input.audienceMax : offering.audienceMax;
      assertAudienceRange({ audienceMin: effMin, audienceMax: effMax });
    }

    // 🔴 P3 / DECISION-0147 — STATE-MACHINE fail-closed (Q4: status NUNCA free-form do body) +
    // GATE DE ATIVAÇÃO (Q1/Q2/Q3: revalida elegibilidade VIVA no momento da ativação). Só checa quando há
    // transição real (status novo ≠ atual). active=público/contratável com base viva; nenhuma offering fica
    // active se a base que a autoriza caiu (a queda em si é tratada pela cascata Q5, fatia P3-3).
    if (input.status != null && input.status !== offering.status) {
      const from = offering.status;
      const to = input.status;
      const allowed =
        (to === 'active' && (from === 'draft' || from === 'suspended')) ||
        (to === 'suspended' && from === 'active');
      if (!allowed) {
        throw new ServiceOfferingError(409, 'SERVICE_OFFERING_INVALID_TRANSITION',
          `Transição de status ${from}→${to} não permitida (DECISION-0147 Q4; status não é free-form do body).`);
      }
      if (to === 'active') {
        // canonical válido (re-resolve ACTIVE) → conceptId p/ a revalidação de elegibilidade.
        const canonical = await canonicalServiceService.requireActiveForTenant(input.tenantId, offering.canonicalServiceId);
        try {
          await assertOfferingActivationEligibility({
            tenantId: input.tenantId,
            providerActorId: offering.providerActorId,
            companyId: offering.companyId ?? null,
            conceptId: canonical.conceptId,
          });
        } catch (e: any) {
          // normaliza p/ ServiceOfferingError (a rota mapeia statusCode/code); preserva o code do gate.
          throw new ServiceOfferingError(e?.statusCode ?? 403, e?.code ?? 'SERVICE_OFFERING_ACTIVATION_DENIED',
            e?.message ?? 'Ativação negada (DECISION-0147).');
        }
      }
    }

    await pool.query(
      `UPDATE service_offerings SET
         price_cents = COALESCE($3, price_cents),
         duration_minutes = COALESCE($4, duration_minutes),
         status = COALESCE($5, status),
         booking_approval_mode = COALESCE($6, booking_approval_mode),
         accept_direct_same_city = COALESCE($7, accept_direct_same_city),
         accept_direct_radius_km = CASE WHEN $8::boolean THEN $9::numeric ELSE accept_direct_radius_km END,
         audience_min = CASE WHEN $10::boolean THEN $11::integer ELSE audience_min END,
         audience_max = CASE WHEN $12::boolean THEN $13::integer ELSE audience_max END,
         updated_at = NOW()
       WHERE id = $1::uuid AND tenant_id = $2::uuid`,
      [
        input.offeringId, input.tenantId, input.priceCents ?? null, input.durationMinutes ?? null, input.status ?? null,
        input.bookingApprovalMode ?? null,
        input.acceptDirectSameCity ?? null,
        // radius é nullable-com-significado: só grava quando explicitamente presente no input (undefined = não mexe).
        input.acceptDirectRadiusKm !== undefined, input.acceptDirectRadiusKm ?? null,
        // audience_min/max nullable-com-significado: só grava quando explicitamente presente no input.
        input.audienceMin !== undefined, input.audienceMin ?? null,
        input.audienceMax !== undefined, input.audienceMax ?? null,
      ]
    );
  },

  /**
   * Declara DISPONIBILIDADE da oferta na Unified Availability (SSOT temporal —
   * owner ('service_offering', id)). NÃO cria calendário paralelo; NÃO é booking.
   */
  async declareAvailability(input: {
    tenantId: string;
    userId: string;
    offeringId: string;
    startDatetime: string;
    endDatetime: string;
    capacity?: number | null;
  }): Promise<UnifiedAvailability> {
    const offering = await this.findById(input.tenantId, input.offeringId);
    if (!offering) throw new ServiceOfferingError(404, 'SERVICE_OFFERING_NOT_FOUND', 'Oferta inexistente.');
    const canRep = await authorizationService.canRepresentActor(input.tenantId, input.userId, offering.providerActorId);
    if (!canRep) {
      throw new ServiceOfferingError(403, 'SERVICE_OFFERING_NOT_REPRESENTABLE',
        'Sem autoridade sobre o prestador desta oferta.');
    }
    // DECISION-0118 D2: service_offering é owner_type CANÔNICO (enum + CHECK físico,
    // sem `as never`); a autoridade é o provider (resolvida aqui e, nas rotas, pela
    // policy polimórfica de availability-owner-authority).
    return unifiedAvailabilityService.createAvailability(input.tenantId, input.userId, {
      ownerType: AvailabilityOwnerType.SERVICE_OFFERING,
      ownerId: offering.id,
      startDatetime: new Date(input.startDatetime),
      endDatetime: new Date(input.endDatetime),
      capacity: input.capacity ?? null,
    });
  },

  /**
   * 🔴 F-PERFORMER-CONTRACTING-POLICY — GATE DE DISTÂNCIA (roda ANTES do confirm, §4.9.5 validate-before-mutate).
   * within-reach = (same_city AND requester.city == provider.city) OR (radius_km set AND haversine_km <= radius_km).
   * Localização do requester OU do provider AUSENTE → NÃO within-reach → fail-closed a NEGOCIA (booking fica
   * 'requested'; nunca auto-confirma sem prova de alcance). Reusa actor_active_location (SSOT) + haversine_distance_km
   * (fn SQL SELADA) — sem recalcular distância em JS, sem caminho geo paralelo.
   */
  async isWithinContractingReach(input: {
    tenantId: string;
    offering: ServiceOffering;
    requesterActorId: string;
  }): Promise<{ withinReach: boolean; reason: string }> {
    const { tenantId, offering, requesterActorId } = input;
    const wantsSameCity = offering.acceptDirectSameCity === true;
    const radiusKm = offering.acceptDirectRadiusKm;
    if (!wantsSameCity && radiusKm == null) {
      return { withinReach: false, reason: 'no_condition' }; // sem condição não há aceita-direto (defesa; CHECK já barra)
    }
    const providerLoc = await actorActiveLocationRepository.getActiveHydrated(tenantId, offering.providerActorId);
    const requesterLoc = await actorActiveLocationRepository.getActiveHydrated(tenantId, requesterActorId);
    if (!providerLoc || !requesterLoc) {
      return { withinReach: false, reason: 'location_absent' }; // fail-closed → negocia
    }
    // (a) MESMA CIDADE via city_id GOVERNADO (resolvido do endereço; NÃO string crua).
    if (wantsSameCity && providerLoc.cityId && requesterLoc.cityId && providerLoc.cityId === requesterLoc.cityId) {
      return { withinReach: true, reason: 'same_city' };
    }
    // (b) RAIO via haversine_distance_km (fn SQL SELADA — DECISION-0030). Exige coordenadas dos dois lados.
    if (radiusKm != null
      && providerLoc.lat != null && providerLoc.lng != null
      && requesterLoc.lat != null && requesterLoc.lng != null) {
      const r = await pool.query<{ km: string | null }>(
        `SELECT haversine_distance_km($1::numeric, $2::numeric, $3::numeric, $4::numeric)::text AS km`,
        [providerLoc.lat, providerLoc.lng, requesterLoc.lat, requesterLoc.lng]
      );
      const km = r.rows[0]?.km == null ? null : Number(r.rows[0].km);
      if (km != null && Number.isFinite(km) && km <= radiusKm) {
        return { withinReach: true, reason: `radius_ok(${km.toFixed(2)}km<=${radiusKm}km)` };
      }
      return { withinReach: false, reason: `radius_exceeded(${km == null ? 'null' : km.toFixed(2)}km>${radiusKm}km)` };
    }
    return { withinReach: false, reason: 'not_within_reach' };
  },

  /**
   * 🔴 F-PERFORMER-CONTRACTING-POLICY — SOLICITAR/RESERVAR uma janela da oferta (entrypoint no NÍVEL DA OFERTA,
   * espelhando rentable-resource.requestBooking). O booking é SEMPRE criado 'requested' primeiro (core createBooking);
   * DEPOIS resolve o gate de distância:
   *   - mode='automatic' + within-reach → CONFIRMA passando pelo CHOKEPOINT ÚNICO de confirm
   *     (unifiedAvailabilityService.updateBooking → confirmBookingWithProviderLock, provider DERIVADO server-side);
   *   - senão (manual, OU automatic fora-de-alcance, OU localização ausente) → fica 'requested' (NEGOCIA).
   * O consumidor NUNCA confirma sozinho — a auto-confirmação é a pré-autorização do DONO aplicada server-side.
   * Conflito de slot no auto-confirm (409 BOOKING_PROVIDER_TIME_CONFLICT do lock) → HARD-FAIL (first-come: o slot
   * foi levado; NÃO rebaixa silenciosamente p/ negocia). PRÉ-DINHEIRO: 'confirmed' = compromisso de agenda (Δbank=0).
   * NÃO forka o lock; NÃO cria segundo caminho de confirm (§4.8).
   */
  async requestBooking(
    tenantId: string,
    offeringId: string,
    availabilityId: string,
    subject: { subjectUserId: string; requesterActorId: string },
    // 🔴 C3 EDGE C-1 — CONTEXTO de contratação orquestrada (opcional). eventId amarra a reserva a um evento
    // do contratante (autoridade manage_attendees exigida ANTES de mutar); configId é metadata SOFT (∈ configs
    // desta oferta). Ambos são persistidos em bookings.metadata (JSONB já existente) para o BIND on-confirm (C-2).
    context?: { eventId?: string; configId?: string },
    // 🔴 2026-08-04 — MENSAGEM do pedido ("pedido de orçamento": para que serviço, quantas pessoas, onde).
    // `bookings.notes` e CreateUnifiedBookingInput.notes JÁ existiam; este caminho era o único que os
    // descartava, entregando ao fornecedor um pedido de janela sem dizer para quê. Texto livre do
    // contratante — NÃO é vocabulário governado, NÃO decide nada, NÃO entra em roteamento financeiro.
    notes?: string | null
  ): Promise<{ bookingId: string; status: string; autoConfirmed: boolean; gateReason: string }> {
    const offering = await this.findById(tenantId, offeringId);
    if (!offering || offering.status !== 'active') {
      throw new ServiceOfferingError(404, 'SERVICE_OFFERING_NOT_BOOKABLE', 'Oferta indisponível/não-ativa.');
    }
    const { unifiedAvailabilityRepository } = await import('@core/availability/unified-availability.repository');
    const availability = await unifiedAvailabilityRepository.findAvailabilityById(tenantId, availabilityId);
    if (!availability || availability.ownerType !== AvailabilityOwnerType.SERVICE_OFFERING || availability.ownerId !== offeringId) {
      throw new ServiceOfferingError(400, 'SERVICE_OFFERING_AVAILABILITY_MISMATCH', 'Janela não pertence a esta oferta.');
    }
    // 🔴 C3 EDGE C-1 — resolve o CONTEXTO (validate-before-mutate, §4.9.5). eventId exige AUTORIDADE de evento
    // (manage_attendees, chave do commitments); configId é SOFT (pertencer à oferta). O metadata só é montado
    // com o que foi validado — nada de valor cru do body vira verdade sem checagem.
    let bookingMetadata: Record<string, unknown> | undefined;
    if (context && (context.eventId || context.configId)) {
      const md: Record<string, unknown> = {};
      if (context.eventId) {
        await assertEventContractingAuthority(tenantId, subject.subjectUserId, context.eventId);
        md.eventId = context.eventId;
      }
      if (context.configId) {
        await assertConfigBelongsToOffering(tenantId, offeringId, context.configId);
        md.configId = context.configId;
      }
      bookingMetadata = md;
    }
    // 1) SEMPRE cria 'requested' primeiro (core revalida oferta active + autoridade do subject — DECISION-0147/0148).
    const booking = await unifiedAvailabilityService.createBooking(
      // O `as any` que estava aqui era o cúmplice silencioso: escondia que `notes` (campo de primeira
      // classe do input) nunca chegava. Tipado, o compilador passa a defender este contrato.
      tenantId, subject, { availabilityId, requesterActorId: subject.requesterActorId, metadata: bookingMetadata, notes: notes ?? null }
    );

    // 2) NEGOCIA (manual) → fica requested; a banda decide depois pelo caminho owner-only (updateBooking).
    if (offering.bookingApprovalMode !== 'automatic') {
      return { bookingId: booking.bookingId, status: booking.status, autoConfirmed: false, gateReason: 'manual' };
    }

    // 3) ACEITA-DIRETO: resolve o gate ANTES de mutar. Fora-de-alcance/ausente → mantém requested (negocia-hold).
    const gate = await this.isWithinContractingReach({ tenantId, offering, requesterActorId: subject.requesterActorId });
    if (!gate.withinReach) {
      return { bookingId: booking.bookingId, status: booking.status, autoConfirmed: false, gateReason: gate.reason };
    }

    // 4) within-reach → CONFIRMA pelo chokepoint ÚNICO (deriva provider server-side + advisory-lock transacional).
    //    409 do lock (slot já levado) PROPAGA como hard-fail — NÃO rebaixa p/ negocia.
    const confirmed = await unifiedAvailabilityService.updateBooking(
      tenantId, booking.bookingId, subject.subjectUserId, { status: UnifiedBookingStatus.CONFIRMED }
    );
    return { bookingId: booking.bookingId, status: confirmed.status, autoConfirmed: true, gateReason: gate.reason };
  },

  /** Ofertas ATIVAS de um serviço canônico (agrupamento por identidade — discovery). */
  async listActiveBycanonicalService(tenantId: string, canonicalServiceId: string): Promise<ServiceOffering[]> {
    const r = await pool.query<SoRow>(
      `SELECT ${SO_SELECT} FROM service_offerings
        WHERE tenant_id = $1::uuid AND canonical_service_id = $2::uuid AND status = 'active'
        ORDER BY created_at ASC`,
      [tenantId, canonicalServiceId]
    );
    return r.rows.map(toOffering);
  },

  // ── C1b — FACET MULTI-GÊNERO (achar banda POR GÊNERO). Elo oferta↔subject-concept governado
  // (service_offering_genre_facets, espelho de event_theme_links). Autoridade = canRepresentActor(provider)
  // fail-closed (padrão selado do offering). Gênero DEVE ser subject-concept GOVERNADO e habilitado
  // (shared_subject_concepts.enabled) — a FK física já impede gênero solto; aqui damos rejeição controlada.
  // Bank-free.

  /** Provider TAGUEIA gêneros na PRÓPRIA oferta (multi, idempotente). Rejeita gênero não-governado. */
  async tagOfferingGenres(input: {
    tenantId: string;
    userId: string;
    offeringId: string;
    subjectConceptIds: string[];
  }): Promise<void> {
    const offering = await this.findById(input.tenantId, input.offeringId);
    if (!offering) throw new ServiceOfferingError(404, 'SERVICE_OFFERING_NOT_FOUND', 'Oferta inexistente.');
    const canRep = await authorizationService.canRepresentActor(input.tenantId, input.userId, offering.providerActorId);
    if (!canRep) {
      throw new ServiceOfferingError(403, 'SERVICE_OFFERING_NOT_REPRESENTABLE',
        'Só o prestador (ou quem o representa) tagueia os gêneros da própria oferta.');
    }
    const ids = Array.from(new Set((input.subjectConceptIds || []).filter((s) => typeof s === 'string' && s.trim())));
    if (ids.length === 0) {
      throw new ServiceOfferingError(400, 'SERVICE_OFFERING_GENRE_EMPTY', 'Nenhum gênero informado.');
    }
    // Governança: cada gênero é subject-concept do pool NEUTRO e habilitado. Fail-closed.
    const governed = await runQueriesWithTenant<{ concept_id: string }>(
      input.tenantId,
      `SELECT concept_id::text AS concept_id FROM shared_subject_concepts
        WHERE enabled = true AND concept_id = ANY($1::uuid[])`,
      [ids]
    );
    if (governed.length !== ids.length) {
      throw new ServiceOfferingError(422, 'SERVICE_OFFERING_GENRE_NOT_GOVERNED',
        'Gênero deve ser um subject-concept governado e habilitado (shared_subject_concepts).');
    }
    for (const conceptId of ids) {
      await runQueryWithTenant(
        input.tenantId,
        `INSERT INTO service_offering_genre_facets (tenant_id, service_offering_id, subject_concept_id)
         VALUES ($1::uuid, $2::uuid, $3::uuid)
         ON CONFLICT (service_offering_id, subject_concept_id) DO NOTHING`,
        [input.tenantId, input.offeringId, conceptId]
      );
    }
  },

  /** Provider REMOVE um gênero da PRÓPRIA oferta. */
  async untagOfferingGenre(input: { tenantId: string; userId: string; offeringId: string; subjectConceptId: string }): Promise<void> {
    const offering = await this.findById(input.tenantId, input.offeringId);
    if (!offering) throw new ServiceOfferingError(404, 'SERVICE_OFFERING_NOT_FOUND', 'Oferta inexistente.');
    const canRep = await authorizationService.canRepresentActor(input.tenantId, input.userId, offering.providerActorId);
    if (!canRep) {
      throw new ServiceOfferingError(403, 'SERVICE_OFFERING_NOT_REPRESENTABLE', 'Só o prestador altera os gêneros da própria oferta.');
    }
    await runQueryWithTenant(
      input.tenantId,
      `DELETE FROM service_offering_genre_facets WHERE service_offering_id = $1::uuid AND subject_concept_id = $2::uuid`,
      [input.offeringId, input.subjectConceptId]
    );
  },

  /** Gêneros (subject_concept_id) de uma oferta. Read-only. */
  async listOfferingGenres(tenantId: string, offeringId: string): Promise<string[]> {
    const r = await runQueriesWithTenant<{ subject_concept_id: string }>(
      tenantId,
      `SELECT subject_concept_id::text AS subject_concept_id FROM service_offering_genre_facets
        WHERE service_offering_id = $1::uuid ORDER BY created_at ASC`,
      [offeringId]
    );
    return r.map((x) => x.subject_concept_id);
  },

  // ── C1c-a (+ ADDENDUM) — FACET de EQUIPAMENTO próprio (raio-x: checklist do que a banda leva). Elo
  // oferta↔equipamento GOVERNADO (service_offering_equipment_facets, espelho de C1b). Autoridade =
  // canRepresentActor(provider) fail-closed. Equipamento do PERFORMER = concept EM use-area governada de
  // palco/evento (rental_equipment_use_area_concepts com code ∈ {audio_video_lighting, events_parties}) —
  // ESTREITADO do critério largo produtos-e-comercio∧rentable (que aceitava motosserra/lavadora). A FK física
  // (→concepts) impede free-text; a pertinência à use-area de palco/evento é validada aqui (422). Bank-free.

  /** Provider TAGUEIA equipamentos na PRÓPRIA oferta (multi, idempotente). Rejeita equipamento não-governado. */
  async tagOfferingEquipment(input: {
    tenantId: string;
    userId: string;
    offeringId: string;
    equipmentConceptIds: string[];
  }): Promise<void> {
    const offering = await this.findById(input.tenantId, input.offeringId);
    if (!offering) throw new ServiceOfferingError(404, 'SERVICE_OFFERING_NOT_FOUND', 'Oferta inexistente.');
    const canRep = await authorizationService.canRepresentActor(input.tenantId, input.userId, offering.providerActorId);
    if (!canRep) {
      throw new ServiceOfferingError(403, 'SERVICE_OFFERING_NOT_REPRESENTABLE',
        'Só o prestador (ou quem o representa) tagueia os equipamentos da própria oferta.');
    }
    const ids = Array.from(new Set((input.equipmentConceptIds || []).filter((s) => typeof s === 'string' && s.trim())));
    if (ids.length === 0) {
      throw new ServiceOfferingError(400, 'SERVICE_OFFERING_EQUIPMENT_EMPTY', 'Nenhum equipamento informado.');
    }
    // Governança (ESTREITADA, addendum): cada concept é equipamento de PALCO/EVENTO — pertence à use-area
    // governada rental_equipment_use_area_concepts com code ∈ {audio_video_lighting, events_parties}. NÃO
    // basta ser bem alugável (produtos-e-comercio∧rentable) — motosserra/lavadora ficam de fora. DISTINCT
    // porque um concept pode estar em várias áreas.
    const governed = await runQueriesWithTenant<{ concept_id: string }>(
      input.tenantId,
      `SELECT DISTINCT c.concept_id::text AS concept_id
         FROM concepts c
         JOIN rental_equipment_use_area_concepts ruac ON ruac.concept_id = c.concept_id
         JOIN rental_equipment_use_areas ua ON ua.id = ruac.use_area_id
        WHERE ua.code IN ('audio_video_lighting', 'events_parties') AND c.concept_id = ANY($1::uuid[])`,
      [ids]
    );
    if (governed.length !== ids.length) {
      throw new ServiceOfferingError(422, 'SERVICE_OFFERING_EQUIPMENT_NOT_GOVERNED',
        'Equipamento deve ser um concept de palco/evento (use-area governada audio_video_lighting/events_parties).');
    }
    for (const conceptId of ids) {
      await runQueryWithTenant(
        input.tenantId,
        `INSERT INTO service_offering_equipment_facets (tenant_id, service_offering_id, equipment_concept_id)
         VALUES ($1::uuid, $2::uuid, $3::uuid)
         ON CONFLICT (service_offering_id, equipment_concept_id) DO NOTHING`,
        [input.tenantId, input.offeringId, conceptId]
      );
    }
  },

  /** Provider REMOVE um equipamento da PRÓPRIA oferta. */
  async untagOfferingEquipment(input: { tenantId: string; userId: string; offeringId: string; equipmentConceptId: string }): Promise<void> {
    const offering = await this.findById(input.tenantId, input.offeringId);
    if (!offering) throw new ServiceOfferingError(404, 'SERVICE_OFFERING_NOT_FOUND', 'Oferta inexistente.');
    const canRep = await authorizationService.canRepresentActor(input.tenantId, input.userId, offering.providerActorId);
    if (!canRep) {
      throw new ServiceOfferingError(403, 'SERVICE_OFFERING_NOT_REPRESENTABLE', 'Só o prestador altera os equipamentos da própria oferta.');
    }
    await runQueryWithTenant(
      input.tenantId,
      `DELETE FROM service_offering_equipment_facets WHERE service_offering_id = $1::uuid AND equipment_concept_id = $2::uuid`,
      [input.offeringId, input.equipmentConceptId]
    );
  },

  /** Equipamentos (equipment_concept_id) de uma oferta. Read-only. */
  async listOfferingEquipment(tenantId: string, offeringId: string): Promise<string[]> {
    const r = await runQueriesWithTenant<{ equipment_concept_id: string }>(
      tenantId,
      `SELECT equipment_concept_id::text AS equipment_concept_id FROM service_offering_equipment_facets
        WHERE service_offering_id = $1::uuid ORDER BY created_at ASC`,
      [offeringId]
    );
    return r.map((x) => x.equipment_concept_id);
  },
};
