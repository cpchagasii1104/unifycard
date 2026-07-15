// backend/src/modules/fiscal-provision/fiscal-provision.types.ts
// FISCAL 4D-1 (DECISION-0167 §2/§4) — contratos do MOTOR READ-ONLY de provisão fiscal.
//
// Separação de casas (GATE FISCAL-4D-0): modules/fiscal GOVERNA e LOCALIZA perfis/regras;
// modules/fiscal-provision CALCULA provisão usando SOMENTE as casas governadas (allowlist §3).
// Nada aqui é vocabulário novo — TUDO composto dos símbolos governados existentes.
//
// O motor NÃO é apuração oficial (§1 — Lei do Contador): produz PROVISÃO INTERNA ESTIMADA,
// derivada exclusivamente de configuração versionada. Zero dinheiro, zero bank_*, zero split.

import type { TaxRegime, TaxpayerKind, PlatformRevenueStream, RoundingMode } from '@modules/fiscal/tax-catalog.types';

/** Versão do cálculo do motor — ecoada em toda decisão/trilha para reprodutibilidade. */
export const FISCAL_CALCULATION_VERSION = 1;

/**
 * Bases de cálculo (0167 §5, vocabulário D9.5.12). NOTA DE FRONTEIRA: isto NÃO estende
 * economic_policy_lines.applies_to (CHECK segue gross|net — extensão é a 4d-2). É o vocabulário
 * do RESULTADO do motor, conforme o contrato §4.
 */
export const FISCAL_BASE_TYPES = ['gross_transaction', 'commission_gross', 'commission_distributable'] as const;
export type FiscalBaseType = (typeof FISCAL_BASE_TYPES)[number];

/** Modo de consumo (0167 §7): informativo NUNCA bloqueia; obrigatório FALHA FECHADO sem config. */
export const FISCAL_CONSUMPTION_MODES = ['informative', 'mandatory'] as const;
export type FiscalConsumptionMode = (typeof FISCAL_CONSUMPTION_MODES)[number];

/** Razões DISCRIMINADAS de ausência (0167 §7.3 — "por que não achou"); espelho do CHECK da trilha. */
export const FISCAL_MISSING_REASONS = [
  'active_platform_fiscal_profile_missing',
  'fiscal_identity_missing',
  'tax_type_missing',
  'tax_rule_missing',
  'tax_rule_out_of_effectivity',
  'fiscal_territory_missing',
  'revenue_stream_invalid',
  'concept_invalid',
  'rounding_mode_missing',
  'fiscal_config_ambiguous',
] as const;
export type FiscalMissingReason = (typeof FISCAL_MISSING_REASONS)[number];

/**
 * TaxableEvent (0167 §2) — o ÚNICO contrato pelo qual o motor enxerga o mundo. Passada autorizada
 * nesta fatia: PROVISÃO DA COMISSÃO DA PLATAFORMA (taxpayer_kind='platform').
 * `commission_gross_cents` chega como FATO econômico já resolvido — o motor NÃO recalcula receita,
 * NÃO busca pedido/checkout/split, NÃO consulta Bank, NÃO consulta ACTOR_RESIDENCE do comprador.
 * Jurisdição fiscal = CADASTRAL DO CONTRIBUINTE, por IDs canônicos do Location Core (nunca texto).
 */
export interface PlatformCommissionTaxableEvent {
  tenantId: string;
  /** Identidade do evento (0167 §2: rastreabilidade de origem) — base da idempotência da trilha. */
  sourceModule: string;
  sourceReferenceId: string;
  taxpayerKind: 'platform';
  platformRevenueStream: PlatformRevenueStream;
  /** Comissão bruta RESOLVIDA (centavos inteiros) — fato de entrada, nunca recomputado aqui. */
  commissionGrossCents: number;
  /** O QUE foi vendido/prestado, quando aplicável (CONCEPT — SSOT semântico). */
  conceptId?: string | null;
  /** Jurisdição fiscal cadastral do CONTRIBUINTE (IDs canônicos; o emissor resolve, o motor usa). */
  countryId: string;
  stateId?: string | null;
  cityId?: string | null;
  occurredAt: Date;
  /** Data de vigência a considerar; default = occurredAt. */
  effectiveAt?: Date;
  currency: 'BRL';
  /** Modo de consumo fiscal EXPLICITAMENTE declarado (0167 §7). */
  consumptionMode: FiscalConsumptionMode;
  /** Versão do contrato do evento. */
  contractVersion: 1;
}

/** TaxProvisionResult (0167 §4) — UMA decisão por regra aplicada. */
export interface TaxProvisionResult {
  status: 'found';
  taxRuleId: string;
  taxRuleVersion: number;
  taxTypeId: string;
  taxpayerKind: TaxpayerKind;
  baseType: FiscalBaseType;
  baseCents: number;
  /** Alíquota da regra — DADO ecoado para auditoria (nunca inventada). */
  rateBps: number;
  /** Modo APLICADO — vem da CONFIGURAÇÃO da regra (0167 §8), nunca escolhido pelo motor. */
  roundingMode: RoundingMode;
  provisionCents: number;
  countryId: string | null;
  stateId: string | null;
  cityId: string | null;
  source: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  warnings: string[];
}

/** Snapshot fiscal imutável (0167 §4) — SEM PII; só IDs canônicos, enums governados e centavos. */
export interface FiscalSnapshot {
  calculationVersion: number;
  taxpayerKind: TaxpayerKind;
  fiscalIdentityId: string;
  actorFiscalProfileId: string;
  actorFiscalProfileVersion: number;
  taxRegime: TaxRegime;
  platformRevenueStream: PlatformRevenueStream;
  conceptId: string | null;
  countryId: string;
  stateId: string | null;
  cityId: string | null;
  occurredAt: string;
  effectiveAt: string;
  baseType: FiscalBaseType;
  commissionGrossCents: number;
  taxReserveCents: number;
  commissionDistributableCents: number;
  rules: Array<{
    taxRuleId: string;
    taxRuleVersion: number;
    taxTypeId: string;
    rateBps: number;
    roundingMode: RoundingMode;
    provisionCents: number;
    source: string;
  }>;
  warnings: string[];
}

/** Resultado agregado da passada — decisão/proposta auditável; NUNCA movimento de dinheiro. */
export type FiscalProvisionOutcome =
  | {
      status: 'found';
      results: TaxProvisionResult[];
      taxReserveCents: number;
      commissionDistributableCents: number;
      warnings: string[];
      fiscalSnapshot: FiscalSnapshot;
    }
  | {
      status: 'fiscal_config_missing';
      missingReason: FiscalMissingReason;
      /** Detalhe honesto e auditável do que falta (0167 §7.3) — nunca inventa. */
      reason: string;
      results: [];
      taxReserveCents: null;
      commissionDistributableCents: null;
      warnings: string[];
    };
