// src/modules/services/service-booking-decision.repository.ts
// Repository do Domínio de CONFIRMAÇÃO / DECISÃO DE BOOKING
// 🔴 BLINDAGEM: Nenhuma decisão deve ser criada sem booking e decided_by_actor
// 🔴 BLINDAGEM: Decisão é humana explícita, nunca automática

import { runQueryWithTenant } from '@core/database/pool';
import type {
  ServiceBookingDecision,
  ServiceBookingDecisionRow,
  CreateServiceBookingDecisionInput,
} from './service-booking-decision.types';
import { BookingDecisionStatus } from './service-booking-decision.types';

class ServiceBookingDecisionRepository {
  /**
   * Converte ServiceBookingDecisionRow para ServiceBookingDecision
   */
  private toServiceBookingDecision(row: ServiceBookingDecisionRow): ServiceBookingDecision {
    return {
      decisionId: row.decision_id,
      tenantId: row.tenant_id,
      bookingId: row.booking_id,
      decidedByActorId: row.decided_by_actor_id,
      serviceOfferingId: row.service_offering_id ?? null,
      status: row.status as BookingDecisionStatus,
      decidedAt: row.decided_at,
      reason: row.reason,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Busca decisão por ID
   */
  async findById(tenantId: string, decisionId: string): Promise<ServiceBookingDecision | null> {
    const row = await runQueryWithTenant<ServiceBookingDecisionRow>(
      tenantId,
      `
      SELECT 
        decision_id, tenant_id, booking_id, decided_by_actor_id,
        service_offering_id,
        status, decided_at, reason, metadata,
        created_at, updated_at
      FROM service_booking_decisions
      WHERE decision_id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [decisionId, tenantId]
    );

    if (!row) {
      return null;
    }

    return this.toServiceBookingDecision(row);
  }

  /**
   * Busca decisão por Booking ID
   * 🔴 BLINDAGEM: Apenas uma decisão por booking
   * Booking continua existindo mesmo se rejeitado
   * Decisão não apaga booking
   */
  async findByBookingId(tenantId: string, bookingId: string): Promise<ServiceBookingDecision | null> {
    const row = await runQueryWithTenant<ServiceBookingDecisionRow>(
      tenantId,
      `
      SELECT 
        decision_id, tenant_id, booking_id, decided_by_actor_id,
        service_offering_id,
        status, decided_at, reason, metadata,
        created_at, updated_at
      FROM service_booking_decisions
      WHERE booking_id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [bookingId, tenantId]
    );

    if (!row) {
      return null;
    }

    return this.toServiceBookingDecision(row);
  }

  /**
   * Cria nova decisão
   * 🔴 BLINDAGEM: bookingId e decidedByActorId são OBRIGATÓRIOS
   * 🔴 BLINDAGEM: Decisão é humana explícita, nunca automática
   * 🔴 BLINDAGEM: Apenas uma decisão por booking (constraint UNIQUE)
   */
  async create(tenantId: string, input: CreateServiceBookingDecisionInput): Promise<ServiceBookingDecision> {
    // 🔴 BLINDAGEM: Validar que todos os IDs foram fornecidos
    if (!input.bookingId) {
      throw new Error('bookingId é obrigatório para criar decisão');
    }
    if (!input.decidedByActorId) {
      throw new Error('decidedByActorId é obrigatório para criar decisão');
    }
    if (!input.status) {
      throw new Error('status é obrigatório para criar decisão');
    }

    const row = await runQueryWithTenant<ServiceBookingDecisionRow>(
      tenantId,
      `
      INSERT INTO service_booking_decisions (
        tenant_id, booking_id, decided_by_actor_id,
        status, decided_at, reason, metadata, service_offering_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (booking_id) DO NOTHING
      RETURNING 
        decision_id, tenant_id, booking_id, decided_by_actor_id,
        service_offering_id,
        status, decided_at, reason, metadata,
        created_at, updated_at
      `,
      [
        tenantId,
        input.bookingId,
        input.decidedByActorId,
        input.status,
        new Date(),
        input.reason || null,
        JSON.stringify(input.metadata || {}),
        input.serviceOfferingId ?? null,
      ]
    );

    if (!row) {
      // Conflito: já existe uma decisão para este booking
      throw new Error('Já existe uma decisão para este booking');
    }

    return this.toServiceBookingDecision(row);
  }
}

export const serviceBookingDecisionRepository = new ServiceBookingDecisionRepository();



