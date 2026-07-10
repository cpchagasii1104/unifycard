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
  | 'channel_commission' // canal genérico (afiliado, RCA, parceiro, marketplace externo)
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
  | 'channel_actor_wallet' // wallet do canal (afiliado, RCA, parceiro)
  | 'escrow_payments'
  | 'custom';

export type EconomicPolicyLineAppliesTo = 'gross' | 'net';

/**
 * Origem regional canônica (DECISION-0049, 2026-05-26).
 *
 * Quando line_type='regional_fund' E destinationKey IS NULL (resolução
 * dinâmica), regionalOriginBasis É OBRIGATÓRIO. Resolver NUNCA faz
 * fallback automático entre basis — se OPERATIONAL pedido e ausente,
 * falha POLICY_REGIONAL_ORIGIN_UNRESOLVABLE.
 *
 * mixed_policy NÃO está aqui: composição é via MÚLTIPLAS linhas
 * regional_fund, cada uma com seu basis próprio.
 *
 * Resolver dinâmico ainda NÃO implementado (frente futura). PE-3
 * continua FAIL-CLOSED em regional_fund.
 */
export type RegionalOriginBasis =
  | 'payer_identity_residence'
  | 'receiver_identity_residence'
  | 'receiver_company_operational'
  | 'receiver_company_hq'
  | 'service_location'
  | 'transaction_location'
  | 'explicit_economic_region';

/**
 * DECISION-0166 D2 (Fase 3): nível territorial da fatia regional — MESMO enum de
 * regional_fund_accounts.scope_level (CHECK chk_regional_level_canonical_values).
 * neighborhood permanece HOLD no resolver enquanto o catálogo não for governado (D4).
 */
export type RegionalFundLevel = 'planet' | 'country' | 'state' | 'city' | 'neighborhood';

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
  /** DECISION-0049: origem regional canônica. Obrigatório por CHECK
   *  quando lineType='regional_fund' AND destinationKey IS NULL. */
  regionalOriginBasis: RegionalOriginBasis | null;
  /** DECISION-0166 D2 (Fase 3): nível territorial da fatia (planet/country/state/
   *  city/neighborhood — mesmo enum de regional_fund_accounts.scope_level).
   *  Obrigatório por CHECK quando lineType='regional_fund'; NULL nas demais.
   *  Ortogonal ao basis: basis = DE ONDE vem a região; level = PARA QUAL nível vai. */
  regionalLevel: RegionalFundLevel | null;
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
  /** DECISION-0049 + DECISION-0051: propagado do policy line para o resolver
   *  dinâmico de regional_fund (PE-5-RESOLVER). */
  regionalOriginBasis: RegionalOriginBasis | null;
  /** DECISION-0166 D2 (Fase 3): nível territorial da linha, propagado ao resolver
   *  (que trunca a jurisdição resolvida ao nível). */
  regionalLevel: RegionalFundLevel | null;
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
  /** DECISION-0049: origem regional canônica. Obrigatório quando
   *  lineType='regional_fund' AND destinationKey é null/ausente
   *  (enforcement via CHECK chk_origin_basis_required_for_dynamic_regional). */
  regionalOriginBasis?: RegionalOriginBasis | null;
  /** DECISION-0166 D2 (Fase 3): obrigatório quando lineType='regional_fund'
   *  (CHECK chk_regional_level_required_for_regional_fund); proibido nas demais. */
  regionalLevel?: RegionalFundLevel | null;
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
