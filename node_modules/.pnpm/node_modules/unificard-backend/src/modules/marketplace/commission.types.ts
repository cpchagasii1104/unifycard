// backend/src/modules/marketplace/commission.types.ts
// SPRINT 74: GROUPS, INDICAÇÕES E COMISSÕES

/**
 * Tipo de aplicação da regra de comissão
 */
export type CommissionAppliesTo = 'GROUP' | 'REFERRAL' | 'PAYMENT_METHOD';

/**
 * Regra de comissão
 */
export interface CommissionRule {
  id: string;
  tenantId: string;
  appliesTo: CommissionAppliesTo;
  appliesId: string;
  basePercentage: number;
  regionalPercentage: number;
  platformPercentage: number;
  createdByActorId: string;
  createdByUserId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

/**
 * Input para criar regra de comissão
 */
export interface CreateCommissionRuleInput {
  appliesTo: CommissionAppliesTo;
  appliesId: string;
  basePercentage?: number;
  regionalPercentage?: number;
  platformPercentage?: number;
  metadata?: Record<string, any>;
}

/**
 * Contexto para cálculo de comissão
 */
export interface CommissionCalculationContext {
  amountCents: number;
  referralCodeId?: string;
  groupId?: string;
  paymentMethodId?: string;
}

/**
 * Resultado do cálculo de comissão (declarativo)
 */
export interface CommissionCalculation {
  baseAmountCents: number;
  regionalAmountCents: number;
  platformAmountCents: number;
  totalAmountCents: number;
  ruleId: string | null;
  appliesTo: CommissionAppliesTo | null;
  appliesId: string | null;
  snapshot: Record<string, any>;
}







