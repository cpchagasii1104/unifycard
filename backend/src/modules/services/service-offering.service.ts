// service-offering.service.ts
// DECISION-0117 D (CP4) — OFERTA de serviço canônico por prestador.
//
// O significado/identidade vive em canonical_services (compartilhado); a oferta
// guarda só o que é do PRESTADOR: price_cents BIGINT, duração EFETIVA,
// profissional executor, modalidade, localização/área, condições, status.
// Disponibilidade = Unified Availability (owner = ('service_offering', id)) —
// NENHUM calendário paralelo. Booking transacional/pagamento FORA (0109/0117).
// Autoridade: canRepresentActor(provider) server-side. Zero Bank writer.

import { pool, runQueryWithTenant } from '@core/database/pool';
import { authorizationService } from '@core/authorization/authorization.service';
import { canonicalServiceService } from '@core/catalog/canonical/canonical-service.service';
import { unifiedAvailabilityService } from '@core/availability/unified-availability.service';
import { AvailabilityOwnerType, type UnifiedAvailability } from '@core/availability/unified-availability.types';
import { assertOfferingActivationEligibility } from './services-offering-activation-gate';

export class ServiceOfferingError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'ServiceOfferingError';
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
}

const SO_SELECT =
  'id, tenant_id, canonical_service_id, provider_actor_id, company_id, price_cents, ' +
  'duration_minutes, professional_actor_id, modality, status';

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
  };
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
         location, service_area, conditions, status
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, 'draft')
       RETURNING ${SO_SELECT}`,
      [
        input.tenantId, canonical.id, serviceId, input.providerActorId, derivedCompanyId,
        input.priceCents, input.durationMinutes, null,
        input.modality ?? 'in_person',
        JSON.stringify(input.location ?? {}), JSON.stringify(input.serviceArea ?? {}),
        JSON.stringify(input.conditions ?? {}),
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
  }): Promise<void> {
    const offering = await this.findById(input.tenantId, input.offeringId);
    if (!offering) throw new ServiceOfferingError(404, 'SERVICE_OFFERING_NOT_FOUND', 'Oferta inexistente.');
    const canRep = await authorizationService.canRepresentActor(input.tenantId, input.userId, offering.providerActorId);
    if (!canRep) {
      throw new ServiceOfferingError(403, 'SERVICE_OFFERING_NOT_REPRESENTABLE',
        'Prestador só altera a própria oferta.');
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
         updated_at = NOW()
       WHERE id = $1::uuid AND tenant_id = $2::uuid`,
      [input.offeringId, input.tenantId, input.priceCents ?? null, input.durationMinutes ?? null, input.status ?? null]
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
};
