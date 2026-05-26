// backend/src/modules/economy/policy-engine/economic-policy.types.ts
//
// Tipos canônicos do Economic Policy Engine (PE-1, 2026-05-26).
// Mirror das migrations 20260530560000..20260530564000.
//
// REGRA: BPS inteiro (0..10000). Sem float. Sem NUMERIC para dinheiro.
// amount_cents sempre BIGINT/integer no banco; number TS aqui.

export type EconomicPolicyType =
  | 'COMMISSION_SPLIT'
  | 'ACCESS_PASS'
  | 'HYBRID'
  | 'ZERO_FEE'
  | 'CONTRACTUAL';

export type EconomicPolicyStatus = 'active' | 'draft' | 'deprecated';

export type EconomicPolicyLineType =
  | 'revenue_share'
  | 'platform_fee'
  | 'regional_fund'
  | 'reserve'
  | 'referral'
  | 'group_allocation'
  | 'rca_commission'
  | 'custom';

export type EconomicPolicyDestinationType =
  | 'receiver_actor'
  | 'actor_wallet'
  | 'platform_fees'
  | 'platform_revenue'
  | 'regional_fund'
  | 'risk_reserve'
  | 'referrer_actor_wallet'
  | 'group_wallet'
  | 'rca_actor_wallet'
  | 'escrow_payments'
  | 'custom';

export type EconomicPolicyLineAppliesTo = 'gross' | 'net';

export interface EconomicPolicy {
  id: string;
  tenantId: string;
  policyCode: string;
  version: number;
  policyType: EconomicPolicyType;
  moduleContext: string;
  vertical: string | null;
  actorType: string | null;
  serviceType: string | null;
  pricingModel: string | null;
  settlementFlow: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  categoryId: string | null;
  channel: string | null;
  campaignId: string | null;
  priority: number;
  status: EconomicPolicyStatus;
  effectiveFrom: string;
  effectiveUntil: string | null;
  metadata: Record<string, unknown>;
  createdByActorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EconomicPolicyLine {
  id: string;
  policyId: string;
  lineType: EconomicPolicyLineType;
  destinationType: EconomicPolicyDestinationType;
  destinationKey: string | null;
  bps: number | null;
  fixedAmountCents: number | null;
  appliesTo: EconomicPolicyLineAppliesTo;
  conditionType: string | null;
  conditionJson: Record<string, unknown>;
  priority: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type AccessPassProductStatus = 'active' | 'draft' | 'inactive';

export interface AccessPassProduct {
  id: string;
  tenantId: string;
  productCode: string;
  version: number;
  vertical: string;
  moduleContext: string;
  actorType: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  durationSeconds: number;
  priceCents: number;
  currency: string;
  commissionOverrideBps: number | null;
  status: AccessPassProductStatus;
  effectiveFrom: string;
  effectiveUntil: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type ActorAccessPassStatus = 'active' | 'expired' | 'cancelled' | 'refunded';

export interface ActorAccessPass {
  id: string;
  tenantId: string;
  actorId: string;
  productId: string;
  startsAt: string;
  endsAt: string;
  status: ActorAccessPassStatus;
  paidPaymentIntentId: string | null;
  paidBankTransactionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyResolutionInput {
  tenantId: string;
  moduleContext: string;
  actorId?: string;
  vertical?: string;
  actorType?: string;
  serviceType?: string;
  pricingModel?: string;
  settlementFlow?: string;
  country?: string;
  region?: string;
  city?: string;
  categoryId?: string;
  channel?: string;
  campaignId?: string;
  transactionTime?: Date;
}

export type PolicyResolutionStatus = 'resolved' | 'ambiguous' | 'not_found' | 'error';

export interface ResolvedEconomicPolicy {
  status: PolicyResolutionStatus;
  policy: EconomicPolicy | null;
  lines: EconomicPolicyLine[];
  appliedAccessPass: ActorAccessPass | null;
  appliedAccessPassProduct: AccessPassProduct | null;
  errorCode?: string;
  errorMessage?: string;
}

export interface CalculatedEconomicSplit {
  lineType: EconomicPolicyLineType;
  destinationType: EconomicPolicyDestinationType;
  destinationKey: string | null;
  bps: number | null;
  amountCents: number;
  metadata?: Record<string, unknown>;
}

export interface PolicyCalculationResult {
  totalAmountCents: number;
  splits: CalculatedEconomicSplit[];
}

export interface CreateEconomicPolicyInput {
  tenantId: string;
  policyCode: string;
  policyType: EconomicPolicyType;
  moduleContext: string;
  vertical?: string | null;
  actorType?: string | null;
  serviceType?: string | null;
  pricingModel?: string | null;
  settlementFlow?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  categoryId?: string | null;
  channel?: string | null;
  campaignId?: string | null;
  priority?: number;
  status?: EconomicPolicyStatus;
  effectiveFrom: Date;
  effectiveUntil?: Date | null;
  metadata?: Record<string, unknown>;
  createdByActorId?: string | null;
  version?: number;
}

export interface CreateEconomicPolicyLineInput {
  policyId: string;
  lineType: EconomicPolicyLineType;
  destinationType: EconomicPolicyDestinationType;
  destinationKey?: string | null;
  bps?: number | null;
  fixedAmountCents?: number | null;
  appliesTo?: EconomicPolicyLineAppliesTo;
  conditionType?: string | null;
  conditionJson?: Record<string, unknown>;
  priority?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateAccessPassProductInput {
  tenantId: string;
  productCode: string;
  vertical: string;
  moduleContext: string;
  actorType?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  durationSeconds: number;
  priceCents: number;
  currency?: string;
  commissionOverrideBps?: number | null;
  status?: AccessPassProductStatus;
  effectiveFrom: Date;
  effectiveUntil?: Date | null;
  metadata?: Record<string, unknown>;
  version?: number;
}

export interface CreateActorAccessPassInput {
  tenantId: string;
  actorId: string;
  productId: string;
  startsAt: Date;
  endsAt: Date;
  status?: ActorAccessPassStatus;
  paidPaymentIntentId?: string | null;
  paidBankTransactionId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface InsertResolutionLogInput {
  tenantId: string;
  policyId: string | null;
  actorId: string | null;
  moduleContext: string;
  resolutionStatus: PolicyResolutionStatus;
  inputJson: Record<string, unknown>;
  selectedPolicyJson?: Record<string, unknown> | null;
  calculatedSplitsJson?: Record<string, unknown> | null;
  accessPassId?: string | null;
  errorCode?: string | null;
}
