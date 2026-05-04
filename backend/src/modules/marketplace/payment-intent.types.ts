// backend/src/modules/marketplace/payment-intent.types.ts
// SPRINT 39.1: MARKETPLACE EXECUÇÃO - Payment Intent
// Tipos para intenções de pagamento

/**
 * Status do payment intent
 */
export type PaymentIntentStatus = 'CREATED' | 'AUTHORIZED' | 'FAILED' | 'CANCELLED';

/**
 * Moeda (compatível com BankCurrency)
 */
export type PaymentCurrency = 'BRL' | 'USD' | 'EUR' | 'TEST';

/**
 * Payment Intent
 * Representa ligação entre Order e pagamento pretendido
 * NÃO executa transação bancária ainda
 */
export interface PaymentIntent {
  id: string;
  tenantId: string;
  orderId: string;
  /** Correlação única do fluxo (intent → transaction → pix → bank). Imutável após criação. */
  traceId: string;
  amountCents: number;
  currency: PaymentCurrency;
  status: PaymentIntentStatus;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar payment intent
 */
export interface CreatePaymentIntentInput {
  orderId: string;
  amountCents: number;
  currency?: PaymentCurrency;
  paymentMethodId?: string; // SPRINT 72: Método de pagamento selecionado
  metadata?: Record<string, any>;
}

/**
 * Input para atualizar payment intent
 */
export interface UpdatePaymentIntentInput {
  status?: PaymentIntentStatus;
  metadata?: Record<string, any>;
}

/**
 * Status da transação de pagamento
 */
export type PaymentTransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

/**
 * Transação de pagamento
 * Registra execução de um Payment Intent
 */
export interface PaymentTransaction {
  id: string;
  tenantId: string;
  paymentIntentId: string;
  /** Cópia do trace_id do intent (consultas e logs sem join). */
  traceId: string;
  bankTransactionId?: string | null;
  amountCents: number;
  currency: PaymentCurrency;
  status: PaymentTransactionStatus;
  errorCode?: string | null;
  /** Método de pagamento usado (ex: PIX, UNIFYCARD) */
  paymentMethod?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para executar pagamento
 */
export interface ExecutePaymentInput {
  paymentIntentId: string;
  buyerActorId: string;
  sellerActorId: string;
  actingUserId?: string;
}



