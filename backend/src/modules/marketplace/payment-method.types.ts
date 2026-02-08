// backend/src/modules/marketplace/payment-method.types.ts
// SPRINT 72: PAYMENT METHODS + UNIFYCARD CORE

/**
 * Tipo de método de pagamento
 */
export type PaymentMethodType = 'CASH' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'VOUCHER' | 'UNIFYCARD';

/**
 * Provedor do método de pagamento
 */
export type PaymentMethodProvider = 'INTERNAL' | 'UNIFYCARD' | 'EXTERNAL';

/**
 * Método de Pagamento
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Payment Method ≠ Acquirer
 * - Payment Method ≠ Payment Execution
 * - Nenhum dinheiro real
 * - Nenhuma taxa aplicada
 * - Apenas estrutura e preparação
 * - Fee e settlement são declarativos (não executam nada)
 */
export interface PaymentMethod {
  id: string;
  tenantId: string;
  actorId: string;
  type: PaymentMethodType;
  provider: PaymentMethodProvider;
  feePercentage: number; // Ex: 0.0299 = 2.99%
  settlementDays: number; // Dias para liquidação (0 = imediato)
  isDefault: boolean;
  createdByActorId: string;
  createdByUserId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

/**
 * Input para criar método de pagamento
 */
export interface CreatePaymentMethodInput {
  actorId: string;
  type: PaymentMethodType;
  provider?: PaymentMethodProvider;
  feePercentage?: number;
  settlementDays?: number;
  isDefault?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Filtros para listar métodos
 */
export interface PaymentMethodFilters {
  actorId?: string;
  type?: PaymentMethodType;
  provider?: PaymentMethodProvider;
  isDefault?: boolean;
  limit?: number;
  offset?: number;
}







