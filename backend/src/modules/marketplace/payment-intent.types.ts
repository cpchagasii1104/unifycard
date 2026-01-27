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
  amount: number;
  currency: PaymentCurrency;
  status: PaymentIntentStatus;
  metadata?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input para criar payment intent
 */
export interface CreatePaymentIntentInput {
  orderId: string;
  amount: number;
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
  bankTransactionId?: string | null;
  amount: number;
  currency: PaymentCurrency;
  status: PaymentTransactionStatus;
  errorCode?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
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

