// backend/src/modules/marketplace/settlement.types.ts
// SPRINT 77: SETTLEMENT REGIONAL + UNIFYBANK CORE

/**
 * Tipo de origem do settlement
 */
export type SettlementSourceType = 'PAYMENT' | 'TICKET' | 'SERVICE';

/**
 * Status do settlement
 */
export type SettlementStatus = 'PENDING' | 'SETTLED' | 'FAILED';

/**
 * Settlement
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Settlement ≠ Payout
 * - Settlement ≠ Split
 * - Settlement ≠ Payment
 * - Tudo explícito e auditável
 * - Nada automático sem ação explícita
 */
export interface Settlement {
  id: string;
  tenantId: string;
  regionId: string;
  sourceType: SettlementSourceType;
  sourceId: string;
  grossAmountCents: number;
  feeAmountCents: number;
  netAmountCents: number;
  currency: string;
  status: SettlementStatus;
  settledAt: Date | null;
  settledByActorId: string | null;
  settledByUserId: string | null;
  failedAt: Date | null;
  failureReason: string | null;
  createdByActorId: string;
  createdByUserId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar settlement a partir de pagamento
 */
export interface CreateSettlementFromPaymentInput {
  regionId: string;
  sourceType: SettlementSourceType;
  sourceId: string;
  grossAmountCents: number;
  feeAmountCents: number;
  metadata?: Record<string, any>;
}

/**
 * Filtros para listar settlements
 */
export interface SettlementFilters {
  regionId?: string;
  sourceType?: SettlementSourceType;
  status?: SettlementStatus;
  limit?: number;
  offset?: number;
}

/**
 * Region Account
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - RegionAccount ≠ BankAccount
 * - Tudo explícito e auditável
 */
export interface RegionAccount {
  id: string;
  tenantId: string;
  regionId: string;
  balanceCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para creditar conta regional
 */
export interface CreditRegionAccountInput {
  amountCents: number;
  currency?: string;
  metadata?: Record<string, any>;
}

/**
 * Input para debitar conta regional
 */
export interface DebitRegionAccountInput {
  amountCents: number;
  currency?: string;
  metadata?: Record<string, any>;
}






