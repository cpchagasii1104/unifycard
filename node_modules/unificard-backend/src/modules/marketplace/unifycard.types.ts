// backend/src/modules/marketplace/unifycard.types.ts
// SPRINT 73: UNIFYCARD ACQUIRING (SIMULADO, CANÔNICO)

/**
 * Status da transação UnifyCard
 */
export type UnifyCardTransactionStatus = 'AUTHORIZED' | 'CAPTURED' | 'SETTLED' | 'FAILED';

/**
 * Tipo de transação UnifyCard
 */
export type UnifyCardTransactionType = 'CREDIT' | 'DEBIT' | 'PIX' | 'VOUCHER';

/**
 * Transação UnifyCard
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - UnifyCard ≠ Banco externo
 * - UnifyCard ≠ Visa/Mastercard
 * - Nenhuma integração externa real
 * - Nenhum dinheiro real
 * - Tudo auditável e reversível
 * - Nenhuma liquidação automática sem ação explícita
 */
export interface UnifyCardTransaction {
  id: string;
  tenantId: string;
  actorId: string;
  paymentIntentId: string;
  paymentMethodId: string | null;
  transactionType: UnifyCardTransactionType;
  status: UnifyCardTransactionStatus;
  grossAmountCents: number;
  feeAmountCents: number;
  netAmountCents: number;
  regionalAccountId: string | null;
  authorizedAt: Date;
  capturedAt: Date | null;
  settledAt: Date | null;
  createdByActorId: string;
  createdByUserId: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input para autorizar transação
 */
export interface AuthorizeTransactionInput {
  paymentIntentId: string;
  paymentMethodId?: string;
  transactionType: UnifyCardTransactionType;
  grossAmountCents: number;
  metadata?: Record<string, any>;
}

/**
 * Input para capturar transação
 */
export interface CaptureTransactionInput {
  transactionId: string;
  metadata?: Record<string, any>;
}

/**
 * Input para liquidar transação
 */
export interface SettleTransactionInput {
  transactionId: string;
  regionalAccountId: string;
  metadata?: Record<string, any>;
}

/**
 * Filtros para listar transações
 */
export interface UnifyCardTransactionFilters {
  actorId?: string;
  status?: UnifyCardTransactionStatus;
  transactionType?: UnifyCardTransactionType;
  paymentIntentId?: string;
  limit?: number;
  offset?: number;
}






