// backend/src/modules/marketplace/payment-split.types.ts
// SPRINT 40.1: MARKETPLACE EXECUÇÃO - Split Declarativo
// Tipos para splits declarativos de pagamento

/**
 * Role do split
 */
export type PaymentSplitRole = 'SELLER' | 'PLATFORM' | 'FUND' | 'OTHER';

/**
 * Payment Split
 * Representa como o dinheiro deve ser dividido (declarativo)
 */
export interface PaymentSplit {
  id: string;
  tenantId: string;
  paymentIntentId: string;
  recipientActorId: string;
  amountCents: number;
  percentage?: number | null;
  role: PaymentSplitRole;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

/**
 * Input para criar um split
 */
export interface CreatePaymentSplitInput {
  recipientActorId: string;
  amountCents: number;
  percentage?: number;
  role: PaymentSplitRole;
  metadata?: Record<string, any>;
}

/**
 * Input para definir múltiplos splits
 */
export interface DefineSplitsInput {
  splits: CreatePaymentSplitInput[];
}









