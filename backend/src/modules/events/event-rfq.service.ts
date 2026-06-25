// backend/src/modules/events/event-rfq.service.ts
// Service para RFQ (Request for Quotation) / ORÇAMENTO EM LOTE
// 🔴 BLINDAGEM: NÃO aceita proposta automaticamente
// 🔴 BLINDAGEM: NÃO cria booking automaticamente
// 🔴 BLINDAGEM: NÃO cria ranking

import { v4 as uuidv4 } from 'uuid';
import { eventRepository } from './event.repository';
import { servicesRepository } from '../services/services.repository';
import { BadRequestError, NotFoundError } from '@core/errors';
import { HttpError } from '@core/errors/http-error';
import type { PermissionKey } from '@core/authorization/permission-keys';
import { runQueryWithTenant } from '@core/database/pool';
import { isActorEffectivelyBlocked } from '@modules/risk-identity/actor-effective-block';
import type {
  EventRFQ,
  CreateEventRFQInput,
  CreateEventRFQResult,
  RFQItem,
  QuoteResponse,
  CreateQuoteResponseInput,
  EventRFQListResult,
  QuoteListResult,
} from './event-rfq.types';
import { RFQStatus } from './event-rfq.types';
import { AvailabilityOwnerType, UnifiedAvailabilityType } from '@core/availability/unified-availability.types';

/**
 * Service para Event RFQ
 * 
 * REGRAS:
 * - RFQ vive em metadata do evento (event.metadata.rfqs)
 * - Propostas vivem em metadata do RFQ (rfq.quotes)
 * - Nenhuma automação silenciosa
 */
class EventRFQService {
  /**
   * 🔴 F-EVENT-RFQ-DECLARATIVE-QUARANTINE-GATE (§4.8.4) — autoridade-ATIVA. canRepresentActor/canPerformAction
   * (rota) DECIDE permissão; quarentena DECIDE se o actor está ATIVO. RFQ declarativo é procurement/metadata
   * (event.metadata.rfqs); quote é PROPOSTA — NÃO aceita quote, NÃO agenda booking, NÃO cria payment_request.
   * Recebe um actorId JÁ RESOLVIDO (organizer/closedBy/provider), NUNCA actionContext/userId cru. Chamar ANTES da
   * 1ª escrita (UPDATE events SET metadata). NÃO toca canRepresentActor (que segue puro). 403 ACTOR_EFFECTIVELY_BLOCKED.
   */
  private async assertActorNotQuarantined(tenantId: string, actorId: string): Promise<void> {
    if (await isActorEffectivelyBlocked(tenantId, actorId)) {
      throw HttpError.forbidden(
        'ACTOR_EFFECTIVELY_BLOCKED: actor em quarentena (ou âncora humana bloqueada) — operação de RFQ/quote bloqueada (§4.8.4).'
      );
    }
  }

  /**
   * Cria novo RFQ para um evento
   * 
   * REGRAS:
   * - Valida que evento existe
   * - Valida que items não está vazio
   * - Salva RFQ no metadata do evento
   */
  async createRFQ(
    tenantId: string,
    organizerActorId: string,
    input: CreateEventRFQInput,
    userId?: string
  ): Promise<CreateEventRFQResult> {
    // 0. Verificar rate limit
    try {
      const { businessRateLimitService } = await import('@core/rate-limiting/business-rate-limit.service');
      const rateLimit = await businessRateLimitService.checkRateLimit(
        tenantId,
        organizerActorId,
        'rfq:create',
        input.eventId
      );
      if (!rateLimit.allowed) {
        const { RateLimitError } = await import('@core/errors');
        throw new RateLimitError(
          `Limite de criação de RFQs excedido. Tente novamente após ${rateLimit.resetAt.toISOString()}`,
          rateLimit.resetAt,
          rateLimit.remaining
        );
      }
    } catch (rateLimitError: any) {
      if (rateLimitError.statusCode === 429) {
        throw rateLimitError; // Propagar erro de rate limit
      }
      // Se não for erro de rate limit, continuar (fail-open)
      console.warn('[EventRFQ] Erro ao verificar rate limit (não bloqueante):', rateLimitError);
    }

    // 1. Validar permissão via authority.service (§4.9)
    if (userId) {
      const { authorityService } = await import('@modules/authority/authority.service');
      const auth = await authorityService.canPerformAction(
        organizerActorId,
        'rfq:create',
        undefined,
        { tenantId, userId }
      );
      if (!auth.allowed) {
        throw HttpError.forbidden(
          auth.reason || 'Você não tem permissão para criar RFQ'
        );
      }
    }

    // 1. Validar que evento existe
    const event = await eventRepository.getEventById(tenantId, input.eventId);
    if (!event) {
      throw new NotFoundError(`Evento não encontrado: ${input.eventId}`);
    }

    // 2. Validar que items não está vazio
    if (!input.items || input.items.length === 0) {
      throw new BadRequestError('RFQ deve conter pelo menos 1 item (necessidade ou serviço)');
    }

    // 3. Validar items
    for (const item of input.items) {
      if (item.type === 'service') {
        // Validar que serviço existe
        const service = await servicesRepository.findById(tenantId, item.id);
        if (!service) {
          throw new NotFoundError(`Serviço não encontrado: ${item.id}`);
        }
      }
      // Se type = 'need', apenas validar que existe no metadata do evento
      if (item.type === 'need') {
        const eventNeeds = event.metadata?.eventNeeds || [];
        const needExists = eventNeeds.some((need: any) => need.id === item.id);
        if (!needExists) {
          throw new NotFoundError(`Necessidade não encontrada no evento: ${item.id}`);
        }
      }
    }

    // 🔴 F-EVENT-RFQ-DECLARATIVE-QUARANTINE-GATE: organizer (scope) bloqueado não cria RFQ. ANTES do UPDATE metadata.
    await this.assertActorNotQuarantined(tenantId, organizerActorId);

    // 4. Criar RFQ
    const rfqId = `rfq_${uuidv4()}`;
    const now = new Date();

    const rfq: EventRFQ = {
      rfqId,
      eventId: input.eventId,
      tenantId,
      organizerActorId,
      items: input.items,
      criteria: input.criteria,
      status: RFQStatus.OPEN,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      closedAt: null,
    };

    // 5. Salvar RFQ no metadata do evento
    const currentMetadata = event.metadata || {};
    const existingRFQs = currentMetadata.rfqs || [];
    
    // Atualizar metadata do evento
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE events
      SET metadata = $1::jsonb,
          updated_at = NOW()
      WHERE tenant_id = $2 AND id = $3
      `,
      [
        JSON.stringify({
          ...currentMetadata,
          rfqs: [...existingRFQs, rfq],
        }),
        tenantId,
        input.eventId,
      ]
    );

    // 6. Criar thread contextual automaticamente (não bloqueante)
    try {
      const { contextualThreadService } = await import('../contextual-messaging/contextual-thread.service');
      await contextualThreadService.getOrCreateThread(tenantId, {
        contextType: 'rfq',
        contextId: rfqId,
        title: `RFQ: ${event.title || 'Sem título'}`,
        participantActorIds: [organizerActorId], // Organizador é participante inicial
        metadata: {
          eventId: input.eventId,
          rfqId,
          autoCreated: true,
        },
      });
    } catch (threadError) {
      // Não bloquear criação do RFQ se thread falhar
      console.error('Erro ao criar thread contextual para RFQ:', threadError);
    }

    // 7. Criar notificação para organizador (não bloqueante)
    try {
      const { createNotificationSafely } = await import('../system-notifications/system-notification.helpers');
      await createNotificationSafely(tenantId, {
        recipientActorId: organizerActorId,
        type: 'rfq_created',
        contextType: 'rfq',
        contextId: rfqId,
        message: `RFQ criado para o evento "${event.title || 'Sem título'}"`,
        metadata: {
          eventId: input.eventId,
          rfqId,
        },
      });
    } catch (notificationError) {
      console.error('Erro ao criar notificação para RFQ criado:', notificationError);
    }

    // 8. Registrar log de auditoria (não bloqueante)
    try {
      const { recordBusinessAuditSafely } = await import('../business-audit/business-audit.helpers');
      await recordBusinessAuditSafely(tenantId, {
        action: 'rfq_created',
        actorId: organizerActorId,
        userId: null, // TODO: obter userId do organizerActorId se necessário
        contextType: 'rfq',
        contextId: rfqId,
        metadata: {
          eventId: input.eventId,
          itemsCount: input.items.length,
        },
      });
    } catch (auditError) {
      console.error('Erro ao registrar log de auditoria para RFQ criado:', auditError);
    }

    // 7. Contar serviços que podem ser notificados
    // (Por enquanto, apenas retornar 0 - notificação pode ser implementada depois)
    const servicesNotified = 0;

    return {
      rfq,
      servicesNotified,
    };
  }

  /**
   * Busca RFQs de um evento
   */
  async getEventRFQs(tenantId: string, eventId: string): Promise<EventRFQListResult> {
    const event = await eventRepository.getEventById(tenantId, eventId);
    if (!event) {
      throw new NotFoundError(`Evento não encontrado: ${eventId}`);
    }

    const rfqs = (event.metadata?.rfqs || []) as EventRFQ[];
    
    // Converter strings para Date se necessário
    const normalizedRFQs = rfqs.map((rfq: any) => ({
      ...rfq,
      createdAt: rfq.createdAt instanceof Date ? rfq.createdAt : new Date(rfq.createdAt),
      updatedAt: rfq.updatedAt instanceof Date ? rfq.updatedAt : new Date(rfq.updatedAt),
      closedAt: rfq.closedAt ? (rfq.closedAt instanceof Date ? rfq.closedAt : new Date(rfq.closedAt)) : null,
    }));

    return {
      rfqs: normalizedRFQs,
      totalCents: normalizedRFQs.length,
    };
  }

  /**
   * Busca RFQ por ID
   */
  async getRFQById(tenantId: string, eventId: string, rfqId: string): Promise<EventRFQ | null> {
    const result = await this.getEventRFQs(tenantId, eventId);
    return result.rfqs.find(rfq => rfq.rfqId === rfqId) || null;
  }

  /**
   * Fecha RFQ (não aceita mais propostas)
   */
  async closeRFQ(
    tenantId: string,
    eventId: string,
    rfqId: string,
    closedByActorId: string
  ): Promise<EventRFQ> {
    const event = await eventRepository.getEventById(tenantId, eventId);
    if (!event) {
      throw new NotFoundError(`Evento não encontrado: ${eventId}`);
    }

    const rfqs = (event.metadata?.rfqs || []) as EventRFQ[];
    const rfqIndex = rfqs.findIndex((r: any) => r.rfqId === rfqId);
    
    if (rfqIndex === -1) {
      throw new NotFoundError(`RFQ não encontrado: ${rfqId}`);
    }

    const rfq = rfqs[rfqIndex] as any;
    if (rfq.status === RFQStatus.CLOSED) {
      throw new BadRequestError('RFQ já está fechado');
    }

    // 🔴 F-EVENT-RFQ-DECLARATIVE-QUARANTINE-GATE: quem fecha (scope) bloqueado não fecha RFQ. ANTES do UPDATE metadata.
    await this.assertActorNotQuarantined(tenantId, closedByActorId);

    // Atualizar RFQ
    rfq.status = RFQStatus.CLOSED;
    rfq.closedAt = new Date();
    rfq.updatedAt = new Date();

    // Salvar no metadata
    const currentMetadata = event.metadata || {};
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE events
      SET metadata = $1::jsonb,
          updated_at = NOW()
      WHERE tenant_id = $2 AND id = $3
      `,
      [
        JSON.stringify({
          ...currentMetadata,
          rfqs,
        }),
        tenantId,
        eventId,
      ]
    );

    return {
      ...rfq,
      createdAt: rfq.createdAt instanceof Date ? rfq.createdAt : new Date(rfq.createdAt),
      updatedAt: rfq.updatedAt instanceof Date ? rfq.updatedAt : new Date(rfq.updatedAt),
      closedAt: rfq.closedAt instanceof Date ? rfq.closedAt : new Date(rfq.closedAt),
    };
  }

  /**
   * Cria proposta (Quote) para um RFQ
   * 
   * REGRAS:
   * - RFQ deve estar OPEN
   * - Serviço deve existir
   * - Não aceita automaticamente
   */
  async createQuote(
    tenantId: string,
    eventId: string,
    providerActorId: string,
    input: CreateQuoteResponseInput,
    userId?: string
  ): Promise<QuoteResponse> {
    // 0. Verificar rate limit
    try {
      const { businessRateLimitService } = await import('@core/rate-limiting/business-rate-limit.service');
      const rateLimit = await businessRateLimitService.checkRateLimit(
        tenantId,
        providerActorId,
        'quote:submit',
        input.rfqId
      );
      if (!rateLimit.allowed) {
        const { RateLimitError } = await import('@core/errors');
        throw new RateLimitError(
          `Limite de submissão de propostas excedido. Tente novamente após ${rateLimit.resetAt.toISOString()}`,
          rateLimit.resetAt,
          rateLimit.remaining
        );
      }
    } catch (rateLimitError: any) {
      if (rateLimitError.statusCode === 429) {
        throw rateLimitError;
      }
      console.warn('[EventRFQ] Erro ao verificar rate limit (não bloqueante):', rateLimitError);
    }

    // 1. Validar permissão via authority.service (§4.9)
    if (userId) {
      const { authorityService } = await import('@modules/authority/authority.service');
      const auth = await authorityService.canPerformAction(
        providerActorId,
        'quote:submit',
        undefined,
        { tenantId, userId }
      );
      if (!auth.allowed) {
        throw HttpError.forbidden(
          auth.reason || 'Você não tem permissão para submeter cotação'
        );
      }
    }

    // 1. Buscar RFQ
    const rfq = await this.getRFQById(tenantId, eventId, input.rfqId);
    if (!rfq) {
      throw new NotFoundError(`RFQ não encontrado: ${input.rfqId}`);
    }

    // 2. Validar que RFQ está OPEN
    if (rfq.status !== RFQStatus.OPEN) {
      throw new BadRequestError(`RFQ não está aberto (status: ${rfq.status})`);
    }

    // 3. Validar que serviço existe
    const service = await servicesRepository.findById(tenantId, input.serviceId);
    if (!service) {
      throw new NotFoundError(`Serviço não encontrado: ${input.serviceId}`);
    }

    // 🔴 F-EVENT-RFQ-DECLARATIVE-QUARANTINE-GATE: provider (scope) bloqueado não cria quote. ANTES do UPDATE metadata.
    await this.assertActorNotQuarantined(tenantId, providerActorId);

    // 4. Criar proposta
    const quoteId = `quote_${uuidv4()}`;
    const now = new Date();
    let validUntil: Date | null = null;
    
    if (input.validityDays && input.validityDays > 0) {
      validUntil = new Date(now);
      validUntil.setDate(validUntil.getDate() + input.validityDays);
    }

    const quote: QuoteResponse = {
      quoteId,
      rfqId: input.rfqId,
      serviceId: input.serviceId,
      providerActorId,
      priceCents: input.priceCents,
      currency: input.currency,
      notes: input.notes || null,
      validityDays: input.validityDays || null,
      validUntil,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // 5. Salvar no metadata do RFQ
    const event = await eventRepository.getEventById(tenantId, eventId);
    if (!event) {
      throw new NotFoundError(`Evento não encontrado: ${eventId}`);
    }

    const currentMetadata = event.metadata || {};
    const rfqs = (currentMetadata.rfqs || []) as EventRFQ[];
    const rfqIndex = rfqs.findIndex((r: any) => r.rfqId === input.rfqId);
    
    if (rfqIndex === -1) {
      throw new NotFoundError(`RFQ não encontrado no evento: ${input.rfqId}`);
    }

    const updatedRFQ = rfqs[rfqIndex] as any;
    const existingQuotes = updatedRFQ.quotes || [];
    updatedRFQ.quotes = [...existingQuotes, quote];
    updatedRFQ.updatedAt = now;

    await runQueryWithTenant(
      tenantId,
      `
      UPDATE events
      SET metadata = $1::jsonb,
          updated_at = NOW()
      WHERE tenant_id = $2 AND id = $3
      `,
      [
        JSON.stringify({
          ...currentMetadata,
          rfqs,
        }),
        tenantId,
        eventId,
      ]
    );

    // 6. Criar notificação para organizador (não bloqueante)
    try {
      const { createNotificationSafely } = await import('../system-notifications/system-notification.helpers');
      await createNotificationSafely(tenantId, {
        recipientActorId: rfq.organizerActorId,
        type: 'quote_received',
        contextType: 'rfq',
        contextId: input.rfqId,
        message: `Nova proposta recebida para o RFQ do evento "${event.title || 'Sem título'}"`,
        metadata: {
          eventId,
          rfqId: input.rfqId,
          quoteId: quote.quoteId,
          providerActorId,
        },
      });
    } catch (notificationError) {
      console.error('Erro ao criar notificação para proposta recebida:', notificationError);
    }

    // 7. Registrar log de auditoria (não bloqueante)
    try {
      const { recordBusinessAuditSafely } = await import('../business-audit/business-audit.helpers');
      await recordBusinessAuditSafely(tenantId, {
        action: 'quote_submitted',
        actorId: providerActorId,
        userId: null, // TODO: obter userId do providerActorId se necessário
        contextType: 'rfq',
        contextId: input.rfqId,
        metadata: {
          eventId,
          quoteId: quote.quoteId,
          serviceId: input.serviceId,
          priceCents: input.priceCents,
          currency: input.currency,
        },
      });
    } catch (auditError) {
      console.error('Erro ao registrar log de auditoria para proposta submetida:', auditError);
    }

    return quote;
  }

  /**
   * Busca propostas de um RFQ
   */
  async getRFQQuotes(
    tenantId: string,
    eventId: string,
    rfqId: string
  ): Promise<QuoteListResult> {
    const rfq = await this.getRFQById(tenantId, eventId, rfqId);
    if (!rfq) {
      throw new NotFoundError(`RFQ não encontrado: ${rfqId}`);
    }

    // Buscar propostas do metadata do RFQ
    const quotes = (rfq as any).quotes || [];
    
    const normalizedQuotes = quotes.map((quote: any) => ({
      ...quote,
      createdAt: quote.createdAt instanceof Date ? quote.createdAt : new Date(quote.createdAt),
      updatedAt: quote.updatedAt instanceof Date ? quote.updatedAt : new Date(quote.updatedAt),
      validUntil: quote.validUntil ? (quote.validUntil instanceof Date ? quote.validUntil : new Date(quote.validUntil)) : null,
    }));

    return {
      quotes: normalizedQuotes,
      totalCents: normalizedQuotes.length,
    };
  }

  /**
   * Aceita uma proposta (Quote) de um RFQ
   * Q3 — Conecta evento → booking de serviço via RFQ
   *
   * §7 LEI_COERENCIA_SISTEMICA: ESTADO → FINANCEIRO → EVENTO
   * 🔴 BLINDAGEM: NÃO executa pagamento — apenas cria booking + payment request pendente
   * 🔴 BLINDAGEM: NÃO aceita automaticamente — requer ação explícita do organizador
   */
  async acceptQuote(
    tenantId: string,
    eventId: string,
    rfqId: string,
    quoteId: string,
    organizerActorId: string,
    organizerUserId: string
  ): Promise<{ quote: QuoteResponse; bookingId: string; paymentRequestId: string }> {
    // 1. Buscar evento e RFQ
    const event = await eventRepository.getEventById(tenantId, eventId);
    if (!event) throw new NotFoundError(`Evento não encontrado: ${eventId}`);

    const rfq = await this.getRFQById(tenantId, eventId, rfqId);
    if (!rfq) throw new NotFoundError(`RFQ não encontrado: ${rfqId}`);

    if (rfq.status === RFQStatus.CLOSED) {
      throw new BadRequestError('RFQ já está fechado');
    }

    const quotes = (rfq as any).quotes || [];
    const quoteIndex = quotes.findIndex((q: any) => q.quoteId === quoteId);
    if (quoteIndex === -1) throw new NotFoundError(`Proposta não encontrada: ${quoteId}`);

    const quote: QuoteResponse = quotes[quoteIndex];

    // 2. Marcar quote como aceita e fechar RFQ no metadata
    const currentMetadata = event.metadata || {};
    const rfqs = (currentMetadata.rfqs || []) as any[];
    const rfqIdx = rfqs.findIndex((r: any) => r.rfqId === rfqId);

    rfqs[rfqIdx].quotes[quoteIndex] = { ...quote, accepted: true, acceptedAt: new Date().toISOString() };
    rfqs[rfqIdx].status = RFQStatus.CLOSED;
    rfqs[rfqIdx].closedAt = new Date().toISOString();
    rfqs[rfqIdx].updatedAt = new Date().toISOString();

    await runQueryWithTenant(
      tenantId,
      `UPDATE events SET metadata = $1::jsonb, updated_at = NOW() WHERE tenant_id = $2 AND id = $3`,
      [JSON.stringify({ ...currentMetadata, rfqs }), tenantId, eventId]
    );

    // 3. Criar disponibilidade ad-hoc para o provider com a data do evento
    // (necessária para o pipeline de booking — data do evento ou agora+1h se não definida)
    const { unifiedAvailabilityService } = await import('@core/availability/unified-availability.service');
    const eventDate = event.metadata?.date ? new Date(event.metadata.date) : new Date();
    const startDatetime = eventDate;
    const endDatetime = new Date(startDatetime.getTime() + 4 * 60 * 60 * 1000); // +4h

    const availability = await unifiedAvailabilityService.createAvailability(tenantId, organizerUserId, {
      ownerType: AvailabilityOwnerType.SERVICE,
      ownerId: quote.serviceId,
      availabilityType: UnifiedAvailabilityType.FIXED,
      startDatetime,
      endDatetime,
      metadata: { rfqId, quoteId, eventId, source: 'rfq_accept' },
    });

    // 4. Criar booking
    // 🔴 DECISION-0148 — subject normalizado: organizerUserId (user_id real) representa organizerActorId (self).
    const booking = await unifiedAvailabilityService.createBooking(
      tenantId,
      { subjectUserId: organizerUserId, requesterActorId: organizerActorId },
      {
        availabilityId: availability.availabilityId,
        requesterActorId: organizerActorId,
        metadata: { rfqId, quoteId, eventId, serviceId: quote.serviceId, source: 'rfq_accept' },
      }
    );

    // 5. Aceitar booking (provider confirma via RFQ)
    const { serviceBookingDecisionService } = await import('../services/service-booking-decision.service');
    const { BookingDecisionStatus } = await import('../services/service-booking-decision.types');
    const { actorRepository } = await import('@modules/social/actor.repository');
    const providerActor = await actorRepository.findById(tenantId, quote.providerActorId);
    const providerUserId = providerActor?.user_id || organizerUserId;

    await serviceBookingDecisionService.createDecision(tenantId, providerUserId, {
      bookingId: booking.bookingId,
      decidedByActorId: quote.providerActorId,
      status: BookingDecisionStatus.ACCEPTED,
    });

    // 6. Criar payment request (pendente — sem executar pagamento)
    const { servicePaymentRequestService } = await import('../services/service-payment-request.service');
    const paymentRequest = await servicePaymentRequestService.createPaymentRequest(
      tenantId,
      organizerUserId,
      {
        bookingId: booking.bookingId,
        serviceId: quote.serviceId,
        payerActorId: organizerActorId,
        receiverActorId: quote.providerActorId,
        amountCents: quote.priceCents,
        currency: quote.currency,
      }
    );

    return {
      quote: { ...quote, accepted: true } as QuoteResponse,
      bookingId: booking.bookingId,
      paymentRequestId: paymentRequest.paymentRequestId,
    };
  }
}

export const eventRFQService = new EventRFQService();



