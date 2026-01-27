// backend/src/modules/events/checkin.service.ts
// SPRINT 76: EVENTS + TICKETING + CHECK-IN (CANÔNICO)

import { eventCheckInRepository } from './event-checkin.repository';
import { ticketSaleRepository } from './ticket-sale.repository';
import { eventTicketRepository } from './event-ticket.repository';
import { eventRepository } from './event.repository';
import type { EventCheckIn, TicketSale } from './event.types';

/**
 * Service para Check-in / Check-out
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Check-in ≠ Pagamento
 * - Check-in só permitido dentro do horário do evento
 * - Tudo auditável
 */
class CheckInService {
  /**
   * Realiza check-in
   * 
   * SPRINT 76: Valida que ticket está PAID e evento está no horário
   */
  async checkIn(
    tenantId: string,
    ticketSaleId: string,
    checkedInByActorId: string,
    checkedInByUserId?: string
  ): Promise<EventCheckIn> {
    // Validar que venda existe e está PAID
    const ticketSale = await ticketSaleRepository.getSaleById(tenantId, ticketSaleId);
    if (!ticketSale) {
      throw new Error(`Venda de ingresso não encontrada: ${ticketSaleId}`);
    }

    if (ticketSale.status !== 'PAID') {
      throw new Error(`Ingresso deve estar PAID para check-in. Status atual: ${ticketSale.status}`);
    }

    // Validar que não há check-in anterior
    const existingCheckIn = await eventCheckInRepository.getCheckInByTicketSale(tenantId, ticketSaleId);
    if (existingCheckIn) {
      throw new Error('Check-in já realizado para este ingresso');
    }

    // Validar que evento está no horário
    const ticket = await eventTicketRepository.getTicketById(tenantId, ticketSale.eventTicketId);
    if (!ticket) {
      throw new Error(`Ingresso não encontrado: ${ticketSale.eventTicketId}`);
    }

    const event = await eventRepository.getEventById(tenantId, ticket.eventId);
    if (!event) {
      throw new Error(`Evento não encontrado: ${ticket.eventId}`);
    }

    const now = new Date();
    if (now < event.startAt) {
      throw new Error(`Check-in só é permitido a partir de ${event.startAt.toISOString()}`);
    }

    if (now > event.endAt) {
      throw new Error(`Check-in não é permitido após o término do evento (${event.endAt.toISOString()})`);
    }

    // Criar check-in
    const checkIn = await eventCheckInRepository.createCheckIn(tenantId, {
      ticketSaleId,
      checkedInByActorId,
      checkedInByUserId: checkedInByUserId || null,
    });

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'EVENT_CHECKIN',
      eventId: event.id,
      ticketSaleId,
      checkInId: checkIn.id,
      checkedInByActorId,
      checkedInByUserId,
    });

    return checkIn;
  }

  /**
   * Realiza check-out
   */
  async checkOut(
    tenantId: string,
    ticketSaleId: string,
    checkedOutByActorId: string,
    checkedOutByUserId?: string
  ): Promise<EventCheckIn> {
    // Buscar check-in
    const checkIn = await eventCheckInRepository.getCheckInByTicketSale(tenantId, ticketSaleId);
    if (!checkIn) {
      throw new Error('Check-in não encontrado');
    }

    if (checkIn.checkedOutAt) {
      throw new Error('Check-out já realizado');
    }

    // Realizar check-out
    const updatedCheckIn = await eventCheckInRepository.checkOut(
      tenantId,
      checkIn.id,
      checkedOutByActorId,
      checkedOutByUserId || null
    );

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'EVENT_CHECKOUT',
      ticketSaleId,
      checkInId: updatedCheckIn.id,
      checkedOutByActorId,
      checkedOutByUserId,
    });

    return updatedCheckIn;
  }

  /**
   * Valida ticket (verifica se pode fazer check-in)
   */
  async validateTicket(
    tenantId: string,
    ticketSaleId: string
  ): Promise<{ valid: boolean; reason?: string; ticketSale?: TicketSale; event?: any }> {
    // Buscar venda
    const ticketSale = await ticketSaleRepository.getSaleById(tenantId, ticketSaleId);
    if (!ticketSale) {
      return { valid: false, reason: 'Venda de ingresso não encontrada' };
    }

    // Validar status
    if (ticketSale.status !== 'PAID') {
      return { valid: false, reason: `Ingresso deve estar PAID. Status atual: ${ticketSale.status}`, ticketSale };
    }

    // Validar que não há check-in anterior
    const existingCheckIn = await eventCheckInRepository.getCheckInByTicketSale(tenantId, ticketSaleId);
    if (existingCheckIn) {
      return { valid: false, reason: 'Check-in já realizado', ticketSale };
    }

    // Validar horário do evento
    const ticket = await eventTicketRepository.getTicketById(tenantId, ticketSale.eventTicketId);
    if (!ticket) {
      return { valid: false, reason: 'Ingresso não encontrado', ticketSale };
    }

    const event = await eventRepository.getEventById(tenantId, ticket.eventId);
    if (!event) {
      return { valid: false, reason: 'Evento não encontrado', ticketSale };
    }

    const now = new Date();
    if (now < event.startAt) {
      return {
        valid: false,
        reason: `Check-in só é permitido a partir de ${event.startAt.toISOString()}`,
        ticketSale,
        event,
      };
    }

    if (now > event.endAt) {
      return {
        valid: false,
        reason: `Check-in não é permitido após o término do evento (${event.endAt.toISOString()})`,
        ticketSale,
        event,
      };
    }

    return { valid: true, ticketSale, event };
  }

  private async recordAudit(
    tenantId: string,
    data: {
      eventType: string;
      eventId?: string;
      ticketSaleId?: string;
      checkInId?: string;
      checkedInByActorId?: string;
      checkedInByUserId?: string | null;
      checkedOutByActorId?: string;
      checkedOutByUserId?: string | null;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'MEDIUM',
        actor_id: data.checkedInByActorId || data.checkedOutByActorId || null,
        actor_type: 'user',
        source: 'events',
        context: {
          event_id: data.eventId,
          ticket_sale_id: data.ticketSaleId,
          check_in_id: data.checkInId,
          checked_in_by_actor_id: data.checkedInByActorId,
          checked_in_by_user_id: data.checkedInByUserId,
          checked_out_by_actor_id: data.checkedOutByActorId,
          checked_out_by_user_id: data.checkedOutByUserId,
        },
      });
    } catch (error) {
      console.warn('[CheckIn] Erro ao registrar auditoria:', error);
    }
  }
}

export const checkInService = new CheckInService();





