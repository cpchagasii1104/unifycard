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

import { servicePaymentRequestRepository } from './service-payment-request.repository';
// 🔴 CORREÇÃO FASE 1B: Removida referência a serviceBookingRepository
// Toda lógica temporal agora usa unifiedAvailabilityService
import { serviceBookingDecisionRepository } from './service-booking-decision.repository';
import { servicesRepository } from './services.repository';
import { actorRepository } from '@modules/social/actor.repository';
import { BadRequestError } from '@core/errors';
import type {
  ServicePaymentRequest,
  CreateServicePaymentRequestInput,
  UpdateServicePaymentRequestInput,
} from './service-payment-request.types';
import { PaymentRequestStatus } from './service-payment-request.types';
import { BookingDecisionStatus } from './service-booking-decision.types';

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

    // 🔴 BLINDAGEM: Emitir effects ao criar payment request
    // Effect é consequência sistêmica, não decisão humana
    // Pagamento é um PEDIDO de pagamento, não execução automática
    try {
      const { eventBus } = await import('@core/events/event-bus');
      const { v4: uuidv4 } = await import('uuid');
      const { ActorEffect } = await import('@modules/social/actor-effects.types');
      
      await eventBus.publish({
        eventId: uuidv4(),
        tenantId,
        type: ActorEffect.SERVICE_PAYMENT_REQUESTED,
        version: 1,
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
    } catch (error) {
      // Não quebra criação se effect falhar
      console.error('Erro ao emitir effects ao criar payment request (não crítico):', error);
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

    // 🔴 BLINDAGEM: Emitir effects se status mudou para 'cancelled'
    // Pagamento é um PEDIDO de pagamento, não execução automática
    if (input.status === PaymentRequestStatus.CANCELLED && currentPaymentRequest.status !== PaymentRequestStatus.CANCELLED) {
      try {
        const { eventBus } = await import('@core/events/event-bus');
        const { v4: uuidv4 } = await import('uuid');
        const { ActorEffect } = await import('@modules/social/actor-effects.types');
        
        await eventBus.publish({
          eventId: uuidv4(),
          tenantId,
          type: ActorEffect.SERVICE_PAYMENT_CANCELLED,
          version: 1,
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
      } catch (error) {
        // Não quebra atualização se effect falhar
        console.error('Erro ao emitir effects ao cancelar payment request (não crítico):', error);
      }
    }

    return updatedPaymentRequest;
  }
}

export const servicePaymentRequestService = new ServicePaymentRequestService();


