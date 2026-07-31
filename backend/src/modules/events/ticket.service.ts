// backend/src/modules/events/ticket.service.ts
// SPRINT 76: EVENTS + TICKETING + CHECK-IN (CANÔNICO)

import { eventTicketRepository, type UpdateEventTicketInput } from './event-ticket.repository';
import { ticketSaleRepository } from './ticket-sale.repository';
import { eventRepository } from './event.repository';
import type { PaymentCurrency } from '../marketplace/payment-intent.types';
import type {
  EventTicket,
  CreateEventTicketInput,
  TicketSale,
  ReserveTicketInput,
} from './event.types';

function toPaymentCurrency(value: string): PaymentCurrency {
  if (value === 'BRL' || value === 'USD' || value === 'EUR' || value === 'TEST') return value;
  return 'BRL';
}

/**
 * Service para Bilheteria
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Ingresso ≠ Produto
 * - Bilhete ≠ Pagamento
 * - Reserva cria PaymentIntent
 * - Payment SUCCESS confirma ticket
 * - Tudo explícito, auditável e declarativo
 */
class TicketService {
  /**
   * Cria tipo de ingresso para evento
   */
  async createTicketType(
    tenantId: string,
    eventId: string,
    input: CreateEventTicketInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<EventTicket> {
    // Validar que evento existe e está PUBLISHED
    const event = await eventRepository.getEventById(tenantId, eventId);
    if (!event) {
      throw new Error(`Evento não encontrado: ${eventId}`);
    }

    if (event.status !== 'PUBLISHED') {
      throw new Error(`Evento deve estar PUBLISHED para criar ingressos. Status atual: ${event.status}`);
    }

    // Validar preço
    if (input.priceCents <= 0) {
      throw new Error('Preço deve ser maior que zero');
    }

    // Validar quantidade
    if (input.quantityTotal <= 0) {
      throw new Error('Quantidade total deve ser maior que zero');
    }

    const ticket = await eventTicketRepository.createTicket(
      tenantId,
      eventId,
      input,
      createdByActorId,
      createdByUserId || null
    );

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'EVENT_TICKET_CREATED',
      eventId,
      ticketId: ticket.id,
      createdByActorId,
      createdByUserId,
    });

    return ticket;
  }

  /**
   * Edita tipo de ingresso (catálogo — Fatia 1 de F-EVENT-TICKETING-CONVERGENCE). Bank-free
   * (price_cents = valor ANUNCIADO, nunca cobrança). Autoridade já provada na rota (manage_events
   * sobre o dono do evento); este método não re-verifica ownership, só delega ao repositório.
   */
  async updateTicketType(
    tenantId: string,
    ticketId: string,
    input: UpdateEventTicketInput
  ): Promise<EventTicket> {
    const updated = await eventTicketRepository.updateTicket(tenantId, ticketId, input);

    await this.recordAudit(tenantId, {
      eventType: 'EVENT_TICKET_UPDATED',
      ticketId: updated.id,
    });

    return updated;
  }

  /**
   * Reserva ingresso (cria PaymentIntent)
   * 
   * SPRINT 76: Reserva cria PaymentIntent, não confirma pagamento
   */
  async reserveTicket(
    tenantId: string,
    ticketId: string,
    input: ReserveTicketInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<{ ticketSale: TicketSale; paymentIntent: any }> {
    // Validar que ticket existe
    const ticket = await eventTicketRepository.getTicketById(tenantId, ticketId);
    if (!ticket) {
      throw new Error(`Ingresso não encontrado: ${ticketId}`);
    }

    // Validar disponibilidade
    if (ticket.quantitySold >= ticket.quantityTotal) {
      throw new Error('Ingressos esgotados');
    }

    // Validar que evento está PUBLISHED
    const event = await eventRepository.getEventById(tenantId, ticket.eventId);
    if (!event) {
      throw new Error(`Evento não encontrado: ${ticket.eventId}`);
    }

    if (event.status !== 'PUBLISHED') {
      throw new Error(`Evento deve estar PUBLISHED para reservar ingressos. Status atual: ${event.status}`);
    }

    // Criar PaymentIntent
    const { paymentIntentService } = await import('../marketplace/payment-intent.service');
    const { orderService } = await import('../marketplace/order.service');
    
    // SPRINT 76: PaymentIntent requer orderId, mas para tickets vamos criar um order temporário
    // Guardrail: Evento ≠ Order, mas PaymentIntent precisa de orderId
    // Criar order temporário apenas para PaymentIntent (metadata indica que é ticket)
    const tempOrder = await orderService.createOrder(tenantId, {
      buyerActorId: input.buyerActorId,
      sellerActorId: event.organizerActorId,
      metadata: {
        is_ticket_order: true,
        ticket_id: ticketId,
        event_id: ticket.eventId,
        referral_code: input.referralCode,
        ...input.metadata,
      },
    });

    // Submeter order (necessário para criar PaymentIntent)
    const submittedOrder = await orderService.submitOrder(tenantId, tempOrder.id);
    
    // Criar PaymentIntent
    const { createPaymentIntent } = await import('@modules/payments/payment-intent-repository');
    const paymentIntent = await createPaymentIntent(tenantId, {
      referenceId: submittedOrder.id,
      gateway: 'internal',
      actorId: input.buyerActorId,
      amountCents: ticket.priceCents,
      currency: toPaymentCurrency(ticket.currency),
      source: 'ticket',
      metadata: {
        ticket_id: ticketId,
        event_id: ticket.eventId,
        buyer_actor_id: input.buyerActorId,
        referral_code: input.referralCode,
        is_ticket: true,
        order_id: submittedOrder.id,
        payment_method_id: input.paymentMethodId,
        ...input.metadata,
      },
    });

    // SPRINT 0: Salvar contact_id no metadata se fornecido
    const saleMetadata: Record<string, any> = {
      referral_code: input.referralCode,
      ...input.metadata,
    };

    // Se payerContactId fornecido no metadata do input, salvar
    if (input.metadata?.payerContactId) {
      saleMetadata.contact_id = input.metadata.payerContactId;
    }

    // Criar venda de ingresso (RESERVED)
    const ticketSale = await ticketSaleRepository.createSale(tenantId, {
      eventTicketId: ticketId,
      buyerActorId: input.buyerActorId,
      paymentIntentId: paymentIntent.id,
      createdByActorId,
      createdByUserId: createdByUserId || null,
      metadata: saleMetadata,
    });

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'TICKET_RESERVED',
      ticketId,
      ticketSaleId: ticketSale.id,
      paymentIntentId: paymentIntent.id,
      createdByActorId,
      createdByUserId,
    });

    return { ticketSale, paymentIntent };
  }

  /**
   * Confirma pagamento de ingresso
   * 
   * SPRINT 76: Chamado quando PaymentIntent é SUCCESS
   * - Confirma ticket
   * - Incrementa quantity_sold
   * - Cria AccountsReceivable
   * - Aplica CommissionService
   */
  async confirmTicketPayment(
    tenantId: string,
    ticketSaleId: string
  ): Promise<TicketSale> {
    // Buscar venda
    const ticketSale = await ticketSaleRepository.getSaleById(tenantId, ticketSaleId);
    if (!ticketSale) {
      throw new Error(`Venda de ingresso não encontrada: ${ticketSaleId}`);
    }

    // C64 fix: alinhado com schema (pending = reservado aguardando pagamento)
    if (ticketSale.status !== 'pending') {
      throw new Error(`Venda deve estar pending para confirmar pagamento. Status atual: ${ticketSale.status}`);
    }

    // Validar que PaymentIntent está SUCCESS
    if (!ticketSale.paymentIntentId) {
      throw new Error('PaymentIntent não encontrado na venda');
    }

    const { paymentIntentService } = await import('../marketplace/payment-intent.service');
    const paymentIntent = await paymentIntentService.getIntentById(tenantId, ticketSale.paymentIntentId);

    if (!paymentIntent) {
      throw new Error(`PaymentIntent não encontrado: ${ticketSale.paymentIntentId}`);
    }

    if (paymentIntent.status !== 'AUTHORIZED') {
      throw new Error(`PaymentIntent deve estar AUTHORIZED. Status atual: ${paymentIntent.status}`);
    }

    // Confirmar venda
    const confirmedSale = await ticketSaleRepository.confirmPayment(tenantId, ticketSaleId);

    // Incrementar quantity_sold
    await eventTicketRepository.incrementQuantitySold(tenantId, ticketSale.eventTicketId);

    // SPRINT 76: Criar AccountsReceivable
    try {
      const { accountsReceivableService } = await import('../marketplace/accounts-receivable.service');
      const ticket = await eventTicketRepository.getTicketById(tenantId, ticketSale.eventTicketId);
      const event = await eventRepository.getEventById(tenantId, ticket!.eventId);

      await accountsReceivableService.createFromPaymentIntent(
        tenantId,
        {
          paymentIntentId: ticketSale.paymentIntentId,
          actorId: event!.organizerActorId,
          sourceType: 'EVENT_TICKET',
          sourceId: ticketSaleId,
          amountCents: ticket!.priceCents,
          expectedAt: new Date(),
        },
        event!.organizerActorId,
        undefined
      );
    } catch (receivableError) {
      // Log mas não bloqueia confirmação
      console.warn(`[Ticket] Erro ao criar AccountsReceivable para ticket sale ${ticketSaleId}:`, receivableError);
    }

    // SPRINT 76: Aplicar CommissionService (snapshot no metadata)
    try {
      const { commissionService } = await import('../marketplace/commission.service');
      const { referralService } = await import('../marketplace/referral.service');
      
      const ticket = await eventTicketRepository.getTicketById(tenantId, ticketSale.eventTicketId);
      const saleMetadata = ticketSale.metadata || {};
      const referralCode = saleMetadata.referral_code;
      let referralCodeId: string | undefined;
      let groupId: string | undefined;

      // Resolver referral code se fornecido
      if (referralCode) {
        const resolved = await referralService.resolveCode(tenantId, referralCode);
        if (resolved) {
          referralCodeId = resolved.referralCode.id;
          groupId = resolved.groupId || undefined;
        }
      }

      // Calcular comissão
      const commissionCalculation = await commissionService.resolveCommission(tenantId, {
        amountCents: ticket!.priceCents,
        referralCodeId,
        groupId,
        paymentMethodId: paymentIntent.metadata?.payment_method_id,
      });

      // Salvar snapshot no metadata da venda (não executa split)
      const updatedMetadata = {
        ...saleMetadata,
        commission_snapshot: commissionCalculation.snapshot,
      };

      // Atualizar metadata (não há método no repository, então vamos fazer update direto)
      // Por enquanto, apenas logamos
      console.log(`[Ticket] Commission snapshot calculado para ticket sale ${ticketSaleId}:`, commissionCalculation.snapshot);
    } catch (commissionError) {
      // Log mas não bloqueia confirmação
      console.warn(`[Ticket] Erro ao calcular comissão para ticket sale ${ticketSaleId}:`, commissionError);
    }

    // SPRINT 84: Atualizar event_settlement quando ticket é confirmado
    try {
      const { eventSettlementService } = await import('../marketplace/event-settlement.service');
      const ticket = await eventTicketRepository.getTicketById(tenantId, ticketSale.eventTicketId);
      const event = await eventRepository.getEventById(tenantId, ticket!.eventId);

      const saleMetadata = (ticketSale.metadata || {}) as Record<string, unknown>;
      const commissionCents = saleMetadata.commission_snapshot && typeof (saleMetadata.commission_snapshot as Record<string, unknown>).total_commission_cents === 'number'
        ? (saleMetadata.commission_snapshot as { total_commission_cents: number }).total_commission_cents
        : 0;

      // Buscar settlement existente ou criar novo
      let eventSettlement = await eventSettlementService.getSettlementByEvent(tenantId, ticket!.eventId);

      if (!eventSettlement) {
        // Criar novo settlement (será atualizado conforme mais tickets são confirmados)
        eventSettlement = await eventSettlementService.createFromEvent(
          tenantId,
          {
            eventId: ticket!.eventId,
            grossRevenue: ticket!.priceCents,
            commissionsAmount: commissionCents,
            regionalFeeAmount: 0, // Será calculado quando settlement for liquidado
            metadata: {
              first_ticket_sale_id: ticketSaleId,
            },
          },
          event!.organizerActorId,
          undefined
        );
      } else {
        // Atualizar settlement existente (somar receita bruta e comissões)
        // Nota: Por enquanto, apenas logamos. Futuro: adicionar método updateSettlement
        console.log(`[Ticket] Event settlement já existe para evento ${ticket!.eventId}. Total atual: ${eventSettlement.grossRevenue}`);
      }
    } catch (settlementError) {
      // Log mas não bloqueia confirmação
      console.warn(`[Ticket] Erro ao atualizar event_settlement para ticket sale ${ticketSaleId}:`, settlementError);
    }

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'TICKET_PAYMENT_CONFIRMED',
      ticketSaleId: confirmedSale.id,
      paymentIntentId: ticketSale.paymentIntentId,
    });

    return confirmedSale;
  }

  /**
   * Cancela ingresso reservado
   */
  async cancelTicket(
    tenantId: string,
    ticketSaleId: string,
    cancelledByActorId: string,
    cancelledByUserId?: string,
    cancellationReason?: string
  ): Promise<TicketSale> {
    const ticketSale = await ticketSaleRepository.getSaleById(tenantId, ticketSaleId);
    if (!ticketSale) {
      throw new Error(`Venda de ingresso não encontrada: ${ticketSaleId}`);
    }

    // C64 fix: alinhado com schema
    if (ticketSale.status !== 'pending') {
      throw new Error(`Venda deve estar pending para cancelar. Status atual: ${ticketSale.status}`);
    }

    const cancelledSale = await ticketSaleRepository.cancelSale(
      tenantId,
      ticketSaleId,
      cancelledByActorId,
      cancellationReason || null
    );

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'TICKET_CANCELLED',
      ticketSaleId: cancelledSale.id,
      cancelledByActorId,
      cancelledByUserId,
      cancellationReason,
    });

    return cancelledSale;
  }

  private async recordAudit(
    tenantId: string,
    data: {
      eventType: string;
      eventId?: string;
      ticketId?: string;
      ticketSaleId?: string;
      paymentIntentId?: string;
      createdByActorId?: string;
      createdByUserId?: string | null;
      cancelledByActorId?: string;
      cancelledByUserId?: string | null;
      cancellationReason?: string | null;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'WARNING',
        actor_id: data.createdByActorId || data.cancelledByActorId || undefined,
        actor_type: 'user',
        source: 'cultural_event_checkin',
        context: {
          event_id: data.eventId,
          ticket_id: data.ticketId,
          ticket_sale_id: data.ticketSaleId,
          payment_intent_id: data.paymentIntentId,
          created_by_user_id: data.createdByUserId,
          cancelled_by_actor_id: data.cancelledByActorId,
          cancelled_by_user_id: data.cancelledByUserId,
          cancellation_reason: data.cancellationReason,
        },
      });
    } catch (error) {
      console.warn('[Ticket] Erro ao registrar auditoria:', error);
    }
  }
}

export const ticketService = new TicketService();


