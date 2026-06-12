// service-offering.service.ts
// DECISION-0117 D (CP4) — OFERTA de serviço canônico por prestador.
//
// O significado/identidade vive em canonical_services (compartilhado); a oferta
// guarda só o que é do PRESTADOR: price_cents BIGINT, duração EFETIVA,
// profissional executor, modalidade, localização/área, condições, status.
// Disponibilidade = Unified Availability (owner = ('service_offering', id)) —
// NENHUM calendário paralelo. Booking transacional/pagamento FORA (0109/0117).
// Autoridade: canRepresentActor(provider) server-side. Zero Bank writer.

import { pool } from '@core/database/pool';
import { authorizationService } from '@core/authorization/authorization.service';
import { canonicalServiceService } from '@core/catalog/canonical/canonical-service.service';
import { unifiedAvailabilityService } from '@core/availability/unified-availability.service';
import type { UnifiedAvailability } from '@core/availability/unified-availability.types';

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

    const existing = await pool.query<SoRow>(
      `SELECT ${SO_SELECT} FROM service_offerings
        WHERE provider_actor_id = $1::uuid AND canonical_service_id = $2::uuid LIMIT 1`,
      [input.providerActorId, canonical.id]
    );
    if (existing.rows[0]) return { offering: toOffering(existing.rows[0]), created: false };

    const ins = await pool.query<SoRow>(
      `INSERT INTO service_offerings (
         tenant_id, canonical_service_id, provider_actor_id, company_id,
         price_cents, duration_minutes, professional_actor_id, modality,
         location, service_area, conditions, status
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, 'active')
       RETURNING ${SO_SELECT}`,
      [
        input.tenantId, canonical.id, input.providerActorId, input.companyId ?? null,
        input.priceCents, input.durationMinutes, input.professionalActorId ?? null,
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
    return unifiedAvailabilityService.createAvailability(input.tenantId, input.userId, {
      ownerType: 'service_offering',
      ownerId: offering.id,
      startDatetime: input.startDatetime,
      endDatetime: input.endDatetime,
      capacity: input.capacity ?? null,
    } as never);
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
