/**
 * @unificard/contracts - Checkout
 * 
 * Tipos de domínio para checkout e transações.
 * Contrato formal UnifyCard → UnifyBank.
 */

/**
 * Contexto do checkout.
 * Define o módulo e informações do evento/transação.
 */
export interface CheckoutContext {
  module: 'EVENT_TICKET' | 'EVENT_CONSUMPTION';
  eventId: string;
  eventType: string;
  cityId: string;
  globalUserId: string;

  // Opcionais
  ticketId?: string;
  consumptionIds?: string[];
  scheduleSlotId?: string;
}

/**
 * Requisição de checkout.
 */
export interface CheckoutRequest {
  amount: number;
  currency: 'BRL';
  paymentMethod: 'UNIFYCARD';
  context: CheckoutContext;
  idempotencyKey?: string; // Chave de idempotência para prevenir duplicação
}

/**
 * Resultado do checkout.
 */
export interface CheckoutResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

/**
 * Input simplificado para checkout de ingresso de evento.
 */
export interface CheckoutEventTicketInput {
  eventId: string;
  idempotencyKey?: string;
}












