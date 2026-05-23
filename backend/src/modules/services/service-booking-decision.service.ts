// src/modules/services/service-booking-decision.service.ts
// Service do Domínio de CONFIRMAÇÃO / DECISÃO DE BOOKING
// 🔴 BLINDAGEM: Booking Decision = decisão humana explícita
// Nunca automática
// Nunca baseada em score, educação, aprendizado ou reputação
// Nenhuma decisão automática
// Nenhuma fila de prioridade
// Nenhuma lógica de "melhor candidato"
// Nenhuma ligação com pagamento
// Nenhuma ligação com educação ou aprendizado

import { createHash } from 'crypto';
import { getClientWithTenant } from '@core/database/pool';
import { insertEventOutboxRow } from '@core/events/event-outbox.repository';
import { serviceBookingDecisionRepository } from './service-booking-decision.repository';
// 🔴 CORREÇÃO FASE 1B: Removida referência a serviceBookingRepository
// Toda lógica temporal agora usa unifiedAvailabilityService
import { servicesRepository } from './services.repository';
import { actorRepository } from '@modules/social/actor.repository';
import { ActorEffect } from '@modules/social/actor-effects.types';
import { BadRequestError } from '@core/errors';
import { HttpError } from '@core/errors/http-error';
import type {
  ServiceBookingDecision,
  CreateServiceBookingDecisionInput,
} from './service-booking-decision.types';
import { BookingDecisionStatus } from './service-booking-decision.types';

/** `event_outbox.event_id` estável por decisão + tipo de effect — alinhado a service-payment-request / EVENT_OUTBOX_E_ENTREGA_CANONICO.md §3 */
function deterministicServiceBookingDecisionOutboxEventId(
  effectType: string,
  tenantId: string,
  decisionId: string
): string {
  const hash = createHash('sha256')
    .update(`${effectType}:${tenantId}:${decisionId}`)
    .digest();
  const b = Buffer.alloc(16);
  hash.copy(b, 0, 0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

class ServiceBookingDecisionService {
  /**
   * Cria uma nova decisão de booking
   * 🔴 BLINDAGEM: bookingId e decidedByActorId são OBRIGATÓRIOS
   * 🔴 BLINDAGEM: Decisão é humana explícita, nunca automática
   * 🔴 BLINDAGEM: Apenas dono do service pode decidir
   */
  async createDecision(
    tenantId: string,
    userId: string,
    input: CreateServiceBookingDecisionInput
  ): Promise<ServiceBookingDecision> {
    // 0. Validar permissão via authority.service (fachada modules — §4.9)
    const { authorityService } = await import('@modules/authority/authority.service');
    const auth = await authorityService.canPerformAction(
      input.decidedByActorId,
      'manage_bookings',
      undefined,
      { tenantId, userId }
    );
    if (!auth.allowed) {
      throw HttpError.forbidden(
        auth.reason || 'Você não tem permissão para decidir sobre bookings'
      );
    }

    // 🔴 BLINDAGEM: Validar que todos os IDs foram fornecidos
    if (!input.bookingId) {
      throw new BadRequestError('bookingId é obrigatório para criar decisão');
    }
    if (!input.decidedByActorId) {
      throw new BadRequestError('decidedByActorId é obrigatório para criar decisão');
    }
    if (!input.status) {
      throw new BadRequestError('status é obrigatório para criar decisão');
    }

    // 🔴 BLINDAGEM: Validar que booking existe via Unified Availability
    const { unifiedAvailabilityService } = await import('@core/availability/unified-availability.service');
    const booking = await unifiedAvailabilityService.getBooking(tenantId, input.bookingId);
    if (!booking) {
      throw new BadRequestError('Booking não encontrado');
    }

    // 🔴 BLINDAGEM: Validar que service existe (do metadata do booking)
    const serviceId = booking.metadata?.serviceId;
    if (!serviceId) {
      throw new BadRequestError('Booking não possui serviceId no metadata');
    }
    const service = await servicesRepository.findById(tenantId, serviceId);
    if (!service) {
      throw new BadRequestError('Service não encontrado');
    }

    // 🔴 BLINDAGEM: Validar que decided_by_actor é o dono do service
    // Apenas o dono do service pode decidir sobre bookings
    if (service.actorId !== input.decidedByActorId) {
      throw new BadRequestError('Apenas o dono do service pode decidir sobre bookings');
    }

    // 🔴 BLINDAGEM: Validar que decided_by_actor existe
    const decidedByActor = await actorRepository.findById(tenantId, input.decidedByActorId);
    if (!decidedByActor) {
      throw new BadRequestError('Actor que decide não encontrado');
    }

    // 🔴 BLINDAGEM: Validar que não existe decisão anterior para este booking
    const existingDecision = await serviceBookingDecisionRepository.findByBookingId(tenantId, input.bookingId);
    if (existingDecision) {
      throw new BadRequestError('Já existe uma decisão para este booking');
    }

    // Criar decisão
    const decision = await serviceBookingDecisionRepository.create(tenantId, {
      ...input,
    });

    // Criar notificação para requester (não bloqueante)
    try {
      const { createNotificationSafely } = await import('../system-notifications/system-notification.helpers');
      const notificationType = input.status === BookingDecisionStatus.ACCEPTED
        ? 'booking_accepted'
        : 'booking_rejected';
      const message = input.status === BookingDecisionStatus.ACCEPTED
        ? `Seu booking para o serviço "${service.name || 'Serviço'}" foi aceito!`
        : `Seu booking para o serviço "${service.name || 'Serviço'}" foi recusado.`;

      await createNotificationSafely(tenantId, {
        recipientActorId: booking.requesterActorId,
        type: notificationType,
        contextType: 'booking',
        contextId: booking.bookingId,
        message,
        metadata: {
          bookingId: booking.bookingId,
          serviceId,
          decisionId: decision.decisionId,
          status: input.status,
        },
      });
    } catch (notificationError) {
      console.error('Erro ao criar notificação para decisão de booking:', notificationError);
    }

    // Registrar log de auditoria (não bloqueante)
    try {
      const { recordBusinessAuditSafely } = await import('../business-audit/business-audit.helpers');
      await recordBusinessAuditSafely(tenantId, {
        action: 'booking_decided',
        actorId: input.decidedByActorId,
        userId: userId,
        contextType: 'booking',
        contextId: booking.bookingId,
        metadata: {
          decisionId: decision.decisionId,
          status: input.status,
          reason: input.reason || null,
          serviceId,
        },
      });
    } catch (auditError) {
      console.error('Erro ao registrar log de auditoria para decisão de booking:', auditError);
    }

    // 🔴 BLINDAGEM: Enfileirar effect na outbox (pós-commit do INSERT da decisão)
    // Effect é consequência sistêmica, não decisão humana
    try {
      const effectType =
        input.status === BookingDecisionStatus.ACCEPTED
          ? ActorEffect.SERVICE_BOOKING_ACCEPTED
          : ActorEffect.SERVICE_BOOKING_REJECTED;

      const outboxClient = await getClientWithTenant(tenantId);
      try {
        await outboxClient.query('BEGIN');
        await insertEventOutboxRow(outboxClient, {
          tenantId,
          eventId: deterministicServiceBookingDecisionOutboxEventId(
            effectType,
            tenantId,
            decision.decisionId
          ),
          eventType: effectType,
          eventVersion: 1,
          payload: {
            actorId: input.decidedByActorId,
            actorType: decidedByActor.actor_type as any,
            intent: 'DECIDE_BOOKING',
            sourceId: decision.decisionId,
            sourceType: 'service_booking_decision',
            metadata: {
              bookingId: booking.bookingId,
              serviceId: service.serviceId,
              status: decision.status,
              reason: decision.reason,
            },
          },
          metadata: {
            userId: userId,
            serviceId: service.serviceId,
            bookingId: booking.bookingId,
            decisionId: decision.decisionId,
          },
        });
        await outboxClient.query('COMMIT');
      } catch (outboxErr) {
        await outboxClient.query('ROLLBACK');
        throw outboxErr;
      } finally {
        outboxClient.release();
      }
    } catch (error) {
      // Não quebra criação se enfileiramento falhar
      console.error('Erro ao enfileirar effect ao criar decisão (não crítico):', error);
    }

    return decision;
  }

  /**
   * Busca decisão por ID
   */
  async getDecision(tenantId: string, decisionId: string): Promise<ServiceBookingDecision | null> {
    return await serviceBookingDecisionRepository.findById(tenantId, decisionId);
  }

  /**
   * Busca decisão por Booking ID
   * 🔴 BLINDAGEM: Apenas uma decisão por booking
   * Booking continua existindo mesmo se rejeitado
   * Decisão não apaga booking
   */
  async getDecisionByBooking(tenantId: string, bookingId: string): Promise<ServiceBookingDecision | null> {
    // Validar que booking existe via Unified Availability
    const { unifiedAvailabilityService } = await import('@core/availability/unified-availability.service');
    const booking = await unifiedAvailabilityService.getBooking(tenantId, bookingId);
    if (!booking) {
      throw new BadRequestError('Booking não encontrado');
    }

    return await serviceBookingDecisionRepository.findByBookingId(tenantId, bookingId);
  }
}

export const serviceBookingDecisionService = new ServiceBookingDecisionService();

