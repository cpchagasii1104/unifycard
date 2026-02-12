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
import type {
  EventRFQ,
  CreateEventRFQInput,
  CreateEventRFQResult,
  RFQItem,
  RFQStatus,
  QuoteResponse,
  CreateQuoteResponseInput,
  EventRFQListResult,
  QuoteListResult,
} from './event-rfq.types';

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

    // 1. Validar permissão via authorization.service (Core de Decisão)
    if (userId) {
      const { authorizationService } = await import('@core/authorization/authorization.service');
      const auth = await authorizationService.canActAs(
        tenantId,
        userId,
        organizerActorId,
        'rfq:create'
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
      createdAt: now,
      updatedAt: now,
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
          updatedAt = NOW()
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
          updatedAt = NOW()
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

    // 1. Validar permissão via authorization.service (Core de Decisão)
    if (userId) {
      const { authorizationService } = await import('@core/authorization/authorization.service');
      const auth = await authorizationService.canActAs(
        tenantId,
        userId,
        providerActorId,
        'quote:submit'
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
      createdAt: now,
      updatedAt: now,
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
          updatedAt = NOW()
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
}

export const eventRFQService = new EventRFQService();



