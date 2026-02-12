// backend/src/modules/marketplace/accounts-receivable.types.ts
// SPRINT 71: ACCOUNTS RECEIVABLE (CONTAS A RECEBER)

/**
 * Status da conta a receber
 */
export type AccountsReceivableStatus = 'PENDING' | 'RECEIVED' | 'CANCELLED' | 'EXPIRED';

/**
 * Tipo de origem
 */
export type AccountsReceivableSourceType = 'MARKETPLACE_ORDER' | 'PDV_ORDER' | 'SERVICE_ORDER' | 'EVENT_TICKET';

/**
 * Conta a Receber
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Append-only: status muda, mas registros não desaparecem
 * - Status declarativos
 * - Audit em todas as mudanças
 * - Accounts Receivable ≠ Payment
 * - Accounts Receivable ≠ Ledger
 * - Nenhuma movimentação financeira
 * - Representa direito de recebimento futuro
 */
export interface AccountsReceivable {
  id: string;
  tenantId: string;
  actorId: string; // Quem deve receber (vendedor/prestador)
  sourceType: AccountsReceivableSourceType;
  sourceId: string;
  amountCents: number;
  currency: string;
  status: AccountsReceivableStatus;
  expectedAt: Date;
  receivedAt: Date | null;
  paymentMethod: string | null;
  receivedByActorId: string | null;
  receivedByUserId: string | null;
  cancelledAt: Date | null;
  cancelledByActorId: string | null;
  cancelledByUserId: string | null;
  cancellationReason: string | null;
  createdByActorId: string;
  createdByUserId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar conta a partir de Payment Intent
 */
export interface CreateFromPaymentIntentInput {
  paymentIntentId: string;
  actorId: string; // Quem deve receber
  sourceType: AccountsReceivableSourceType;
  sourceId: string;
  amountCents: number;
  currency?: string;
  expectedAt: Date | string;
  paymentMethod?: string;
  metadata?: Record<string, any>;
}

/**
 * Input para criar conta manual
 */
export interface CreateManualReceivableInput {
  actorId: string;
  sourceType: AccountsReceivableSourceType;
  sourceId: string;
  amountCents: number;
  currency?: string;
  expectedAt: Date | string;
  paymentMethod?: string;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * Filtros para listar contas
 */
export interface AccountsReceivableFilters {
  actorId?: string;
  status?: AccountsReceivableStatus;
  sourceType?: AccountsReceivableSourceType;
  sourceId?: string;
  expectedAtFrom?: Date | string;
  expectedAtTo?: Date | string;
  limit?: number;
  offset?: number;
}







