// backend/src/modules/marketplace/payment-intent.types.ts
// SPRINT 39.1: MARKETPLACE EXECUÇÃO - Payment Intent
// Tipos para intenções de pagamento
//
// @deprecated DECISION-0032 (2026-05-12) — vocabulário UPPERCASE não é canônico.
// O tipo soberano de payment_status é `PaymentIntentStatus` em
// `modules/payments/payment-intent-repository.ts` (lowercase, 11 valores do CHECK constraint).
// `marketplace/payment-intent.service.ts` já marcado `@deprecated parcial — C52 Passo 4`.
// Este arquivo permanece para callers legados não migrados; convergência total é fatia futura
// (Fase 1 da DECISION-0032, item "marcar Writer A como deprecated" — agora completo neste header).

/**
 * @deprecated DECISION-0032 — usar `PaymentIntentStatus` de `@modules/payments/payment-intent-repository`.
 * Vocabulário UPPERCASE não é canônico (§4.11/§19.8 da Nomenclatura Canônica).
 * Os valores válidos são lowercase conforme CHECK constraint da tabela payment_intents.
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
// Convergido para minúsculo em 2026-08-01 (§4.11) junto com o CHECK físico que passou a existir
// em `payment_transactions.status` — a coluna era TEXT SEM CHECK, aceitando qualquer string,
// enquanto a irmã `payment_intents` já era minúscula e travada. Este tipo foi achado pelo
// COMPILADOR, não pelo grep: corrigir o repositório primeiro fez o tsc apontar os 3 sítios que
// ainda comparavam contra a união antiga.
export type PaymentTransactionStatus = 'pending' | 'success' | 'failed';

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



