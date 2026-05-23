// src/modules/services/service-payment-request.service.ts
// Service do Domínio de PAGAMENTO (Payment Request / Payment Intent)
// 🔴 BLINDAGEM: Pagamento nasce APÓS booking aceito
// 🔴 BLINDAGEM: Pagamento é um PEDIDO de pagamento, não execução automática
// 🔴 BLINDAGEM: Nenhuma execução automática
// 🔴 BLINDAGEM: Nenhuma cobrança
// 🔴 BLINDAGEM: Nenhuma integração real
// 🔴 BLINDAGEM: Nenhum split
// 🔴 BLINDAGEM: Nenhum check-in
// 🔴 BLINDAGEM: Nenhuma decisão sistêmica

import { createHash } from 'crypto';
import { getClientWithTenant } from '@core/database/pool';
import { insertEventOutboxRow } from '@core/events/event-outbox.repository';
import { servicePaymentRequestRepository } from './service-payment-request.repository';
// 🔴 CORREÇÃO FASE 1B: Removida referência a serviceBookingRepository
// Toda lógica temporal agora usa unifiedAvailabilityService
import { serviceBookingDecisionRepository } from './service-booking-decision.repository';
import { servicesRepository } from './services.repository';
import { actorRepository } from '@modules/social/actor.repository';
import { ActorEffect } from '@modules/social/actor-effects.types';
import { BadRequestError } from '@core/errors';
import type {
  ServicePaymentRequest,
  CreateServicePaymentRequestInput,
  UpdateServicePaymentRequestInput,
} from './service-payment-request.types';
import { PaymentRequestStatus } from './service-payment-request.types';
import { BookingDecisionStatus } from './service-booking-decision.types';

/**
 * `event_outbox.event_id` UUID estável por pedido — pós-commit após `repository.create`
 * (repositório não aceita `PoolClient`; ver EVENT_OUTBOX_E_ENTREGA_CANONICO.md §3).
 */
function deterministicServicePaymentRequestedOutboxEventId(
  tenantId: string,
  paymentRequestId: string
): string {
  const hash = createHash('sha256')
    .update(`SERVICE_PAYMENT_REQUESTED:${tenantId}:${paymentRequestId}`)
    .digest();
  const b = Buffer.alloc(16);
  hash.copy(b, 0, 0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * UUID estável por cancelamento — pós-commit após `repository.update` (ramo CANCELLED).
 */
function deterministicServicePaymentCancelledOutboxEventId(
  tenantId: string,
  paymentRequestId: string
): string {
  const hash = createHash('sha256')
    .update(`SERVICE_PAYMENT_CANCELLED:${tenantId}:${paymentRequestId}`)
    .digest();
  const b = Buffer.alloc(16);
  hash.copy(b, 0, 0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

class ServicePaymentRequestService {
  /**
   * Cria um novo pedido de pagamento
   * 🔴 BLINDAGEM: bookingId, serviceId, payerActorId e receiverActorId são OBRIGATÓRIOS
   * 🔴 BLINDAGEM: Só pode criar payment se existir booking_decision = accepted
   * 🔴 BLINDAGEM: Pagamento nasce APÓS booking aceito
   */
  async createPaymentRequest(
    tenantId: string,
    userId: string,
    input: CreateServicePaymentRequestInput
  ): Promise<ServicePaymentRequest> {
    // 🔴 BLINDAGEM: Validar que todos os IDs foram fornecidos
    if (!input.bookingId) {
      throw new BadRequestError('bookingId é obrigatório para criar payment request');
    }
    if (!input.serviceId) {
      throw new BadRequestError('serviceId é obrigatório para criar payment request');
    }
    if (!input.payerActorId) {
      throw new BadRequestError('payerActorId é obrigatório para criar payment request');
    }
    if (!input.receiverActorId) {
      throw new BadRequestError('receiverActorId é obrigatório para criar payment request');
    }
    if (!input.amountCents || input.amountCents <= 0) {
      throw new BadRequestError('amountCents deve ser maior que zero');
    }

    // 🔴 BLINDAGEM: Validar que booking existe via Unified Availability
    const { unifiedAvailabilityService } = await import('@core/availability/unified-availability.service');
    const booking = await unifiedAvailabilityService.getBooking(tenantId, input.bookingId);
    if (!booking) {
      throw new BadRequestError('Booking não encontrado');
    }

    // 🔴 BLINDAGEM: Validar que service existe
    const service = await servicesRepository.findById(tenantId, input.serviceId);
    if (!service) {
      throw new BadRequestError('Service não encontrado');
    }

    // 🔴 BLINDAGEM: Validar que booking pertence ao service (do metadata)
    const bookingServiceId = booking.metadata?.serviceId;
    if (bookingServiceId !== input.serviceId) {
      throw new BadRequestError('Booking não pertence ao service informado');
    }

    // 🔴 BLINDAGEM: Validar que payer_actor existe
    const payerActor = await actorRepository.findById(tenantId, input.payerActorId);
    if (!payerActor) {
      throw new BadRequestError('Actor pagador não encontrado');
    }

    // 🔴 BLINDAGEM: Validar que receiver_actor existe
    const receiverActor = await actorRepository.findById(tenantId, input.receiverActorId);
    if (!receiverActor) {
      throw new BadRequestError('Actor receptor não encontrado');
    }

    // 🔴 BLINDAGEM: Validar que receiver_actor é dono do service
    if (service.actorId !== input.receiverActorId) {
      throw new BadRequestError('Actor receptor deve ser dono do service');
    }

    // 🔴 BLINDAGEM: Validar que payer_actor é requester do booking
    if (booking.requesterActorId !== input.payerActorId) {
      throw new BadRequestError('Actor pagador deve ser o solicitante do booking');
    }

    // 🔴 BLINDAGEM: REGRA OBRIGATÓRIA - Só pode criar payment se existir booking_decision = accepted
    const decision = await serviceBookingDecisionRepository.findByBookingId(tenantId, input.bookingId);
    if (!decision) {
      throw new BadRequestError('Não é possível criar payment request sem decisão de booking aceita');
    }
    if (decision.status !== BookingDecisionStatus.ACCEPTED) {
      throw new BadRequestError('Só é possível criar payment request se booking foi aceito');
    }

    // Criar payment request
    const paymentRequest = await servicePaymentRequestRepository.create(tenantId, {
      ...input,
      currency: input.currency || 'FIC', // Default: moeda fictícia
    });

    // 🔴 BLINDAGEM: Enfileirar effect na outbox (pós-commit do INSERT do pedido)
    // Effect é consequência sistêmica, não decisão humana
    try {
      const outboxClient = await getClientWithTenant(tenantId);
      try {
        await outboxClient.query('BEGIN');
        await insertEventOutboxRow(outboxClient, {
          tenantId,
          eventId: deterministicServicePaymentRequestedOutboxEventId(
            tenantId,
            paymentRequest.paymentRequestId
          ),
          eventType: ActorEffect.SERVICE_PAYMENT_REQUESTED,
          eventVersion: 1,
          payload: {
            actorId: input.payerActorId,
            actorType: payerActor.actor_type as any,
            intent: 'REQUEST_PAYMENT',
            sourceId: paymentRequest.paymentRequestId,
            sourceType: 'service_payment_request',
            metadata: {
              bookingId: booking.bookingId,
              serviceId: service.serviceId,
              amountCents: paymentRequest.amountCents,
              currency: paymentRequest.currency,
              status: paymentRequest.status,
            },
          },
          metadata: {
            userId: userId,
            serviceId: service.serviceId,
            bookingId: booking.bookingId,
            paymentRequestId: paymentRequest.paymentRequestId,
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
      console.error('Erro ao enfileirar effect ao criar payment request (não crítico):', error);
    }

    return paymentRequest;
  }

  /**
   * Busca payment request por ID
   */
  async getPaymentRequest(tenantId: string, paymentRequestId: string): Promise<ServicePaymentRequest | null> {
    return await servicePaymentRequestRepository.findById(tenantId, paymentRequestId);
  }

  /**
   * Busca payment request por Booking ID
   * 🔴 BLINDAGEM: Apenas um pedido de pagamento por booking (constraint UNIQUE)
   */
  async getPaymentRequestByBooking(tenantId: string, bookingId: string): Promise<ServicePaymentRequest | null> {
    // Validar que booking existe via Unified Availability
    const { unifiedAvailabilityService } = await import('@core/availability/unified-availability.service');
    const booking = await unifiedAvailabilityService.getBooking(tenantId, bookingId);
    if (!booking) {
      throw new BadRequestError('Booking não encontrado');
    }

    return await servicePaymentRequestRepository.findByBookingId(tenantId, bookingId);
  }

  /**
   * Lista payment requests de um Service
   * 🔴 BLINDAGEM: Nenhuma query deve usar payment como filtro decisório
   */
  async getServicePaymentRequests(
    tenantId: string,
    serviceId: string,
    filters?: { status?: PaymentRequestStatus }
  ): Promise<ServicePaymentRequest[]> {
    // Validar que service existe
    const service = await servicesRepository.findById(tenantId, serviceId);
    if (!service) {
      throw new BadRequestError('Service não encontrado');
    }

    return await servicePaymentRequestRepository.findByService(tenantId, serviceId, filters);
  }

  /**
   * Atualiza payment request
   * 🔴 BLINDAGEM: Nenhuma execução automática
   * 🔴 BLINDAGEM: Nenhuma cobrança
   * 🔴 BLINDAGEM: Nenhuma integração real
   */
  async updatePaymentRequest(
    tenantId: string,
    paymentRequestId: string,
    userId: string,
    input: UpdateServicePaymentRequestInput
  ): Promise<ServicePaymentRequest> {
    // Buscar payment request atual
    const currentPaymentRequest = await servicePaymentRequestRepository.findById(tenantId, paymentRequestId);
    if (!currentPaymentRequest) {
      throw new BadRequestError('Payment request não encontrado');
    }

    // Validar que service existe
    const service = await servicesRepository.findById(tenantId, currentPaymentRequest.serviceId);
    if (!service) {
      throw new BadRequestError('Service não encontrado');
    }

    // 🔴 BLINDAGEM: Validar permissão (simplificado - pode ser expandido)
    // Por enquanto, apenas verificar se usuário é owner do service ou payer
    // TODO: Expandir para verificar permissões de grupo/page

    // Atualizar payment request
    const updatedPaymentRequest = await servicePaymentRequestRepository.update(tenantId, paymentRequestId, input);

    // 🔴 BLINDAGEM: Enfileirar effect na outbox se status mudou para 'cancelled'
    // Pagamento é um PEDIDO de pagamento, não execução automática
    if (input.status === PaymentRequestStatus.CANCELLED && currentPaymentRequest.status !== PaymentRequestStatus.CANCELLED) {
      try {
        const outboxClient = await getClientWithTenant(tenantId);
        try {
          await outboxClient.query('BEGIN');
          await insertEventOutboxRow(outboxClient, {
            tenantId,
            eventId: deterministicServicePaymentCancelledOutboxEventId(
              tenantId,
              updatedPaymentRequest.paymentRequestId
            ),
            eventType: ActorEffect.SERVICE_PAYMENT_CANCELLED,
            eventVersion: 1,
            payload: {
              actorId: currentPaymentRequest.payerActorId,
              actorType: 'user' as any, // Será resolvido pelo effect handler
              intent: 'REQUEST_PAYMENT',
              sourceId: updatedPaymentRequest.paymentRequestId,
              sourceType: 'service_payment_request',
              metadata: {
                bookingId: currentPaymentRequest.bookingId,
                serviceId: service.serviceId,
                amountCents: updatedPaymentRequest.amountCents,
                currency: updatedPaymentRequest.currency,
                status: updatedPaymentRequest.status,
                cancelled: true,
              },
            },
            metadata: {
              userId: userId,
              serviceId: service.serviceId,
              bookingId: currentPaymentRequest.bookingId,
              paymentRequestId: updatedPaymentRequest.paymentRequestId,
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
        // Não quebra atualização se enfileiramento falhar
        console.error('Erro ao enfileirar effect ao cancelar payment request (não crítico):', error);
      }
    }

    return updatedPaymentRequest;
  }
}

export const servicePaymentRequestService = new ServicePaymentRequestService();


