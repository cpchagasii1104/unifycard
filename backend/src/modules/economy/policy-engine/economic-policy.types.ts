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

// ── FISCAL 4D-2 (DECISION-0178) — vocabulário de applies_to: físico(5) × gravável(3) × legado(2) ──
//
// CHECK físico = 5 valores (migration 20260715120000). Readers reconhecem os 5.
// Writers NOVOS gravam SÓ os 3 canônicos (writer/tipos/manifesto/guard enforçam — o CHECK não
// distingue histórico de gravação nova). gross|net são LEGADOS READ-ONLY (histórico congelado):
// NUNCA graváveis por novo writer, NUNCA aliases dos 3, NUNCA reinterpretados/rederivados.

/** Base física aceita pelo CHECK (readers reconhecem os 5). */
export const ECONOMIC_POLICY_APPLIES_TO_PHYSICAL = [
  'gross',
  'net',
  'gross_transaction',
  'commission_gross',
  'commission_distributable',
] as const;
export type EconomicPolicyAppliesToPhysical = (typeof ECONOMIC_POLICY_APPLIES_TO_PHYSICAL)[number];

/** Bases GRAVÁVEIS por novo writer (DECISION-0178 D1/D4). */
export const ECONOMIC_POLICY_APPLIES_TO_WRITABLE = [
  'gross_transaction',
  'commission_gross',
  'commission_distributable',
] as const;
export type EconomicPolicyAppliesToWritable = (typeof ECONOMIC_POLICY_APPLIES_TO_WRITABLE)[number];

/** Legados READ-ONLY preservados no CHECK apenas para o histórico congelado (D3). */
export const ECONOMIC_POLICY_APPLIES_TO_LEGACY_READONLY = ['gross', 'net'] as const;
export type EconomicPolicyAppliesToLegacyReadonly = (typeof ECONOMIC_POLICY_APPLIES_TO_LEGACY_READONLY)[number];

/** Tipo do reader: aceita os 5 valores físicos (o histórico pode conter gross|net). */
export type EconomicPolicyLineAppliesTo = EconomicPolicyAppliesToPhysical;

/**
 * Narrowing GOVERNADO physical→writable (D2/D8/D13). NÃO é cast cego: valida e discrimina.
 * Ausência → fail-closed (a base é intenção explícita do caller, sem default/fallback).
 * Legado gross|net → fail-closed read-only (histórico deve ser lido do SNAPSHOT, não reavaliado).
 */
export function assertWritableAppliesTo(value: string | null | undefined): EconomicPolicyAppliesToWritable {
  if (value === null || value === undefined) {
    throw new Error(
      'ECONOMIC_POLICY_APPLIES_TO_REQUIRED: applies_to é obrigatório para gravar linha de policy — ' +
        'base é intenção explícita do caller governado (DECISION-0178 D2; sem default/fallback).'
    );
  }
  if ((ECONOMIC_POLICY_APPLIES_TO_LEGACY_READONLY as readonly string[]).includes(value)) {
    throw new Error(
      `ECONOMIC_POLICY_APPLIES_TO_LEGACY_READONLY: '${value}' é legado read-only — nenhum novo writer ` +
        'pode gravá-lo (DECISION-0178 D1/D3). Histórico gross|net deve ser lido do snapshot, não reavaliado/rederivado.'
    );
  }
  if (!(ECONOMIC_POLICY_APPLIES_TO_WRITABLE as readonly string[]).includes(value)) {
    throw new Error(
      `ECONOMIC_POLICY_APPLIES_TO_INVALID: '${value}' não é base gravável — ` +
        `use uma de ${ECONOMIC_POLICY_APPLIES_TO_WRITABLE.join('|')} (DECISION-0178 D1; sem alias, sem 6º valor).`
    );
  }
  return value as EconomicPolicyAppliesToWritable;
}

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
 * ⚠️ CORRIGIDO 2026-07-28 (4ª auditoria da DECISION-0194, achado F8 — a
 * redação anterior dizia "Resolver dinâmico ainda NÃO implementado (frente
 * futura). PE-3 continua FAIL-CLOSED em regional_fund", e isso MENTE hoje).
 * Verdade verificada: o resolver EXISTE e resolve — `resolveRegionalFundDestination`
 * (service-payment-execution.service.ts:228), chamado em :201-202, com
 * `regional_fund` em SUPPORTED_DESTINATION_TYPES desde DECISION-0051 (:54-61).
 * O fail-closed remanescente é PARCIAL, não geral: vale só para os basis sem
 * fonte material (POLICY_BASIS_UNSUPPORTED_MVP) e para regionalLevel
 * 'neighborhood' (HOLD 501). O conjunto resolvível vive em
 * REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP / REGIONAL_FUND_LEVEL_RESOLVABLE_MVP
 * abaixo — declaração policiada por guard contra o motor.
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

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (declaração guard-policiada — autoridade real é o resolver, não aqui)
// ║ NORMA:   backend/scripts/audit-regional-fund-resolvable-basis-declaration.mjs
// ║ NÃO:     editar as 2 constantes abaixo sem o resolver ter mudado de fato (guard morde RED)
// ║ EM VEZ:  mudar o resolver primeiro, então rodar o guard para recomputar/confirmar aqui
// ╚════════════════════════════════════════════════════════════════
// ── REGIONAL FUND RESOLVER — subconjunto RESOLVÍVEL hoje (DECLARADO, guard-policiado, NÃO fonte) ──
//
// A frente "regional-fund publish-time containment" (2026-07-27) fechou o buraco em que o painel
// oferecia os 7/5 valores físicos acima mas o resolver de pagamento (resolveRegionalFundDestination,
// service-payment-execution.service.ts) rejeitava 3 deles e segurava 1 nível incondicionalmente —
// Clayton podia publicar uma policy garantida a falhar quando o dinheiro se movesse. O resolver é
// BYTE-PINNED por audit-fiscal-economic-policy-composition.mjs (BYTE_INTACT.F.SPE) — fora de
// alcance para esta frente, mesmo comentário. As duas constantes abaixo são a alternativa: uma
// DECLARAÇÃO derivada e POLICIADA, nunca uma segunda verdade. O guard
// `audit-regional-fund-resolvable-basis-declaration.mjs` lê o resolver READ-ONLY, extrai
// comportamentalmente (a) quais valores de basis ele rejeita incondicionalmente com
// POLICY_BASIS_UNSUPPORTED_MVP e (b) se regionalLevel='neighborhood' ainda é HOLD fail-closed
// (REGIONAL_FUND_NEIGHBORHOOD_HOLD/501), e FALHA (RED) se as constantes abaixo divergirem do que o
// resolver hoje realmente resolve. O resolver — nunca esta constante — é a autoridade; editar aqui
// sem o resolver mudar de fato (ou vice-versa, sem atualizar aqui) quebra o guard. Consumidores
// (economic-policy-write-validation.ts no publish; GET /economy/admin/regional-fund-vocabulary
// para o painel) DEVEM importar destas constantes — é PROIBIDO reimplementar a lista em outro lugar
// (isso recriaria exatamente a segunda verdade que esta frente existe para eliminar).

/** Subconjunto de RegionalOriginBasis que o resolver hoje RESOLVE de fato (não lança
 *  POLICY_BASIS_UNSUPPORTED_MVP). service_location / transaction_location / explicit_economic_region
 *  ficam de fora — sem fonte material no schema (PE-5-RESOLVER-V2; ver comentário no resolver). */
export const REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP = [
  'payer_identity_residence',
  'receiver_identity_residence',
  'receiver_company_operational',
  'receiver_company_hq',
] as const;
export type RegionalOriginBasisResolvableMvp = (typeof REGIONAL_ORIGIN_BASIS_RESOLVABLE_MVP)[number];

/** Subconjunto de RegionalFundLevel que o resolver hoje RESOLVE de fato. 'neighborhood' está em
 *  HOLD fail-closed (REGIONAL_FUND_NEIGHBORHOOD_HOLD, 501, DECISION-0166 D4) — o CATÁLOGO de
 *  bairros em si já foi governado (frente N3: 75 bairros oficiais de Curitiba selados), mas o
 *  resolver de pagamento não foi religado a ele; religar é decisão soberana futura, fora do escopo
 *  desta frente (a justificativa original do hold — "catálogo não governado" — está PARCIALMENTE
 *  desatualizada; o hold em si continua vigente até decisão explícita). */
export const REGIONAL_FUND_LEVEL_RESOLVABLE_MVP = [
  'planet',
  'country',
  'state',
  'city',
] as const;
export type RegionalFundLevelResolvableMvp = (typeof REGIONAL_FUND_LEVEL_RESOLVABLE_MVP)[number];

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
  /** @deprecated FATIA 0 (2026-07-27) — substituído por countryId (Location Core). Não usar em código novo. */
  country: string | null;
  /** @deprecated FATIA 0 (2026-07-27) — substituído por stateId (Location Core; "region" corresponde a "state"). Não usar em código novo. */
  region: string | null;
  /** @deprecated FATIA 0 (2026-07-27) — substituído por cityId (Location Core). Não usar em código novo. */
  city: string | null;
  /** FK governada countries(country_id) — Location Core (DECISION-0020). Seletor territorial canônico. */
  countryId: string | null;
  /** FK governada states(state_id) — Location Core (DECISION-0020). Corresponde semanticamente a "region". */
  stateId: string | null;
  /** FK governada cities(city_id) — Location Core (DECISION-0020). */
  cityId: string | null;
  categoryId: string | null;
  channel: string | null;
  campaignId: string | null;
  priority: number;
  status: EconomicPolicyStatus;
  effectiveFrom: string;
  effectiveUntil: string | null;
  metadata: Record<string, unknown>;
  createdByActorId: string | null;
  /** FATIA 2 (2026-07-27) — ARTIGO XI: justificativa do autor para esta versão. Ver
   *  migration 20260727110000. Mandatório por camada de aplicação no write API admin
   *  (POST /economy/admin/policies); NULLABLE no schema por compatibilidade com chamadores
   *  pré-existentes de economicPolicyRepository.createPolicy fora deste escopo. */
  changeReason: string | null;
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
  /** @deprecated FATIA 0 (2026-07-27) — substituído por countryId (Location Core). Não usar em código novo. */
  country?: string;
  /** @deprecated FATIA 0 (2026-07-27) — substituído por stateId (Location Core; "region" corresponde a "state"). Não usar em código novo. */
  region?: string;
  /** @deprecated FATIA 0 (2026-07-27) — substituído por cityId (Location Core). Não usar em código novo. */
  city?: string;
  /** FK governada countries(country_id) — Location Core (DECISION-0020). Seletor territorial canônico. */
  countryId?: string;
  /** FK governada states(state_id) — Location Core (DECISION-0020). Corresponde semanticamente a "region". */
  stateId?: string;
  /** FK governada cities(city_id) — Location Core (DECISION-0020). */
  cityId?: string;
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
  /** @deprecated FATIA 0 (2026-07-27) — substituído por countryId (Location Core). Não usar em código novo. */
  country?: string | null;
  /** @deprecated FATIA 0 (2026-07-27) — substituído por stateId (Location Core; "region" corresponde a "state"). Não usar em código novo. */
  region?: string | null;
  /** @deprecated FATIA 0 (2026-07-27) — substituído por cityId (Location Core). Não usar em código novo. */
  city?: string | null;
  /** FK governada countries(country_id) — Location Core (DECISION-0020). Seletor territorial canônico. */
  countryId?: string | null;
  /** FK governada states(state_id) — Location Core (DECISION-0020). Corresponde semanticamente a "region". */
  stateId?: string | null;
  /** FK governada cities(city_id) — Location Core (DECISION-0020). */
  cityId?: string | null;
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
  /** FATIA 2 (2026-07-27) — ver EconomicPolicy.changeReason. Opcional aqui (compatibilidade com
   *  chamadores pré-existentes fora do write API admin); o write API novo sempre o preenche e o
   *  valida como obrigatório ANTES de chamar o repository (ver assertCreatePolicyVersionRequestValid). */
  changeReason?: string | null;
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
