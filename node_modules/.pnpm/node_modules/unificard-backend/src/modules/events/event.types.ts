// backend/src/modules/events/event.types.ts
// SPRINT 76: EVENTS + TICKETING + CHECK-IN (CANÔNICO)

/**
 * Status do evento
 */
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'CANCELLED';

/**
 * Tipo de ingresso
 */
export type EventTicketType = 'GENERAL' | 'VIP' | 'BACKSTAGE';

/**
 * Status da venda de ingresso
 */
export type TicketSaleStatus = 'RESERVED' | 'PAID' | 'CANCELLED';

/**
 * Evento
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Evento ≠ Order
 * - Tudo explícito, auditável e declarativo
 */
export interface Event {
  id: string;
  tenantId: string;
  organizerActorId: string;
  title: string;
  description: string | null;
  locationActorId: string | null;
  startAt: Date;
  endAt: Date;
  status: EventStatus;
  publishedAt: Date | null;
  publishedByActorId: string | null;
  closedAt: Date | null;
  cancelledAt: Date | null;
  cancelledByActorId: string | null;
  cancellationReason: string | null;
  createdByActorId: string;
  createdByUserId: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input para criar evento
 */
export interface CreateEventInput {
  organizerActorId: string;
  title: string;
  description?: string;
  locationActorId?: string;
  startAt: Date | string;
  endAt: Date | string;
  metadata?: Record<string, any>;
}

/**
 * Tipo de ingresso
 */
export interface EventTicket {
  id: string;
  tenantId: string;
  eventId: string;
  ticketType: EventTicketType;
  priceCents: number;
  currency: string;
  quantityTotal: number;
  quantitySold: number;
  createdByActorId: string;
  createdByUserId: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input para criar tipo de ingresso
 */
export interface CreateEventTicketInput {
  ticketType: EventTicketType;
  priceCents: number;
  currency?: string;
  quantityTotal: number;
  metadata?: Record<string, any>;
}

/**
 * Venda de ingresso
 */
export interface TicketSale {
  id: string;
  tenantId: string;
  eventTicketId: string;
  buyerActorId: string;
  paymentIntentId: string | null;
  status: TicketSaleStatus;
  reservedAt: Date;
  paidAt: Date | null;
  cancelledAt: Date | null;
  cancelledByActorId: string | null;
  cancellationReason: string | null;
  createdByActorId: string;
  createdByUserId: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input para reservar ingresso
 */
export interface ReserveTicketInput {
  buyerActorId: string;
  paymentMethodId?: string;
  referralCode?: string;
  metadata?: Record<string, any>;
}

/**
 * Check-in
 */
export interface EventCheckIn {
  id: string;
  tenantId: string;
  ticketSaleId: string;
  checkedInAt: Date;
  checkedInByActorId: string;
  checkedInByUserId: string | null;
  checkedOutAt: Date | null;
  checkedOutByActorId: string | null;
  checkedOutByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Filtros para listar eventos
 */
export interface EventFilters {
  organizerActorId?: string;
  locationActorId?: string;
  status?: EventStatus;
  startAtFrom?: Date | string;
  startAtTo?: Date | string;
  limit?: number;
  offset?: number;
}






