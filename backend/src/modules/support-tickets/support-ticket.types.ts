// backend/src/modules/support-tickets/support-ticket.types.ts
// F-SUPPORT-TICKET-BUSINESS-FACT-GATE (Fatia 6) — o "Chamado" gated por FATO DE NEGÓCIO real.
// NÃO é o domínio `disputes`/`reconciliation` (disputa financeira/reversão contábil) — este
// módulo é comunicação entre as DUAS PARTES REAIS de um negócio (Δbank=0, nunca reverte nada).

export const SUPPORT_TICKET_REFERENCE_TYPES = ['order', 'service_order', 'booking'] as const;
export type SupportTicketReferenceType = (typeof SUPPORT_TICKET_REFERENCE_TYPES)[number];

export const SUPPORT_TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export interface SupportTicket {
  id: string;
  tenantId: string;
  referenceType: SupportTicketReferenceType;
  referenceId: string;
  fromActorId: string;
  toActorId: string;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OpenSupportTicketInput {
  referenceType: SupportTicketReferenceType;
  referenceId: string;
  toActorId: string;
  subject: string;
  message: string;
}

export interface RespondSupportTicketInput {
  status: SupportTicketStatus;
}

export interface SupportTicketFilters {
  status?: SupportTicketStatus;
  limit?: number;
  offset?: number;
}

/** As duas partes REAIS de um fato de negócio, resolvidas a partir da fonte de verdade viva
 *  (orders/service_orders/bookings+availability) — nunca duplicadas, sempre lidas na hora. */
export interface BusinessFactParties {
  partyA: string;
  partyB: string;
}

/** Referência elegível para abrir chamado com um actor específico (projeção leve p/ UI escolher). */
export interface EligibleBusinessFactReference {
  referenceType: SupportTicketReferenceType;
  referenceId: string;
  counterpartActorId: string;
  label: string;
}
