// src/modules/inbox/social-inbox.projector.ts
// Projector para INBOX SOCIAL DE AÇÕES
// 🔴 BLINDAGEM: Inbox é READ MODEL (derivado de effects)
// 🔴 BLINDAGEM: Inbox NÃO decide nada
// 🔴 BLINDAGEM: Inbox NÃO cria ação automática
// 🔴 BLINDAGEM: Inbox apenas ORGANIZA o que já aconteceu

import { socialInboxRepository } from './social-inbox.repository';
import type { UnificardEvent } from '@core/events/event-bus';
import { InboxSourceType } from './social-inbox.types';
import { ActorEffect } from '@modules/social/actor-effects.types';

/**
 * Projector para Social Inbox Read Models
 * 🔴 BLINDAGEM: Apenas organização, não decisão
 */
class SocialInboxProjector {
  /**
   * Projeta item do inbox a partir de um effect
   * 🔴 BLINDAGEM: Inbox é READ MODEL, criado a partir de effects
   */
  async projectInboxItem(event: UnificardEvent): Promise<void> {
    const payload = event.payload as any;
    const metadata = event.metadata || {};

    // 🔴 BLINDAGEM: Determinar actor destinatário e tipo de fonte baseado no effect
    let targetActorId: string | undefined;
    let sourceType: InboxSourceType | undefined;
    let sourceId: string | undefined;

    switch (event.type) {
      case ActorEffect.OPPORTUNITY_DISPATCHED:
        // Dispatch: destinatário é o actor que recebeu o dispatch
        targetActorId = payload.actorId;
        sourceType = InboxSourceType.DISPATCH;
        sourceId = payload.sourceId || metadata.dispatchId;
        // ⚠️ NOTA: Se metadata.contextType = 'rfq', o dispatch é de RFQ
        // O projector já projeta corretamente como DISPATCH, não precisa alteração
        break;

      case ActorEffect.OPPORTUNITY_DISPATCH_RESPONDED:
        // Dispatch respondido: destinatário é o actor que recebeu o dispatch
        targetActorId = payload.actorId;
        sourceType = InboxSourceType.DISPATCH;
        sourceId = payload.sourceId || metadata.dispatchId;
        break;

      case ActorEffect.SERVICE_BOOKING_REQUESTED:
        // Booking: destinatário é o dono do service (não o requester)
        // Por enquanto, vamos usar o actorId do payload (pode ser ajustado)
        targetActorId = payload.actorId;
        sourceType = InboxSourceType.BOOKING;
        sourceId = payload.sourceId || metadata.bookingId;
        break;

      case ActorEffect.SERVICE_BOOKING_ACCEPTED:
      case ActorEffect.SERVICE_BOOKING_REJECTED:
        // Decisão: destinatário é o requester do booking
        targetActorId = payload.actorId;
        sourceType = InboxSourceType.DECISION;
        sourceId = payload.sourceId || metadata.bookingId;
        break;

      case ActorEffect.SERVICE_PAYMENT_REQUESTED:
        // Payment request: destinatário é o payer
        targetActorId = payload.actorId;
        sourceType = InboxSourceType.PAYMENT;
        sourceId = payload.sourceId || metadata.paymentRequestId;
        break;

      case ActorEffect.SERVICE_PAYMENT_EXECUTED:
        // Payment executado: destinatário é o receiver
        targetActorId = payload.actorId;
        sourceType = InboxSourceType.PAYMENT;
        sourceId = payload.sourceId || metadata.executionId;
        break;

      case ActorEffect.AVAILABILITY_CONFLICT_DETECTED:
        // 🔴 BLINDAGEM: Conflito de disponibilidade detectado (alerta, não bloqueio)
        // Destinatário é o actor que deve ser alertado (participante ou requester)
        // source_type: 'availability_conflict'
        // source_id: availability_id (principal)
        targetActorId = payload.actorId;
        sourceType = InboxSourceType.AVAILABILITY_CONFLICT;
        sourceId = metadata.availabilityId || payload.sourceId;
        break;

      default:
        // Effect não gera item do inbox
        return;
    }

    if (!targetActorId || !sourceType || !sourceId) {
      // Não criar item se dados estiverem incompletos
      return;
    }

    // 🔴 BLINDAGEM: Criar ou atualizar item do inbox (READ MODEL)
    // Não decide nada, apenas organiza o que já aconteceu
    // 🔴 HARDENING: Log estruturado antes de projetar
    const { structuredLogger } = await import('@core/utils/structured-logger');
    structuredLogger.logInboxProjection('info', 'Projetando item do inbox', {
      tenantId: event.tenantId,
      actorId: targetActorId,
      effectType: event.type,
      sourceType,
      sourceId,
    });

    try {
      await socialInboxRepository.upsert(
        event.tenantId,
        targetActorId,
        sourceType,
        sourceId,
        {
          effectType: event.type,
          effectVersion: event.version,
          ...metadata,
        }
      );
    } catch (error) {
      // Não quebra fluxo principal se projeção falhar
      // 🔴 HARDENING: Log estruturado para observabilidade
      const { structuredLogger } = await import('@core/utils/structured-logger');
      structuredLogger.logInboxProjection('error', 'Erro ao projetar item do inbox (não crítico)', {
        tenantId: event.tenantId,
        actorId: targetActorId,
        effectType: event.type,
        sourceType,
        sourceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  /**
   * Projeta o item de inbox do NASCIMENTO de uma service_order confirmada.
   * 🔴 BLINDAGEM: Inbox é READ MODEL — a ordem JÁ existe (efeito = nascimento da service_order);
   * este projector apenas ORGANIZA o que já aconteceu, NÃO decide nada e NÃO cria ação.
   * 🔴 BLINDAGEM: NADA financeiro entra no item — sem amount/price/split/payment; sem CRM
   * (agreements/evidence/invoice). Destinatário = provider/worker (atendimento mínimo).
   * Idempotente por design: socialInboxRepository.upsert usa ON CONFLICT (actor_id, source_type, source_id)
   * → reprocessar o mesmo service_order NÃO duplica o item.
   */
  async projectServiceOrderConfirmed(
    tenantId: string,
    params: {
      serviceOrderId: string;
      providerActorId: string;
      bookingId?: string | null;
      decisionId?: string | null;
      serviceId?: string | null;
    }
  ): Promise<void> {
    const { serviceOrderId, providerActorId, bookingId, decisionId, serviceId } = params;
    if (!serviceOrderId || !providerActorId) {
      return; // dados incompletos: não cria item
    }
    try {
      await socialInboxRepository.upsert(
        tenantId,
        providerActorId,
        InboxSourceType.ORDER,
        serviceOrderId,
        {
          effectType: 'SERVICE_ORDER_CONFIRMED',
          serviceOrderId,
          ...(bookingId != null && { bookingId }),
          ...(decisionId != null && { decisionId }),
          ...(serviceId != null && { serviceId }),
        }
      );
    } catch (error) {
      // 🔴 BLINDAGEM: não quebra o fluxo principal se a projeção do read-model falhar.
      const { structuredLogger } = await import('@core/utils/structured-logger');
      structuredLogger.logInboxProjection('error', 'Erro ao projetar inbox de service_order (não crítico)', {
        tenantId,
        actorId: providerActorId,
        effectType: 'SERVICE_ORDER_CONFIRMED',
        sourceType: InboxSourceType.ORDER,
        sourceId: serviceOrderId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const socialInboxProjector = new SocialInboxProjector();

