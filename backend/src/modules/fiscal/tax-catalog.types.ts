// backend/src/modules/fiscal/tax-catalog.types.ts
// DECISION-0166 D9 (Lei do Contador) — Fase 4c-2: camada de types + vocabulário do CATÁLOGO FISCAL
// (tax_types / tax_rules criados vazios na 4c-1). SÓ estrutura de leitura/escrita governada —
// NENHUM cálculo de imposto aqui (motor = 4d, GO próprio D9.7).
//
// TaxRegime é REUSADO da casa 4b (fiscal-profile.types) — NÃO redeclarar (D9.4 anti-verdade-paralela).

import { TAX_REGIMES, FISCAL_CONFIG_MISSING } from './fiscal-profile.types';
import type { TaxRegime } from './fiscal-profile.types';

export { TAX_REGIMES, FISCAL_CONFIG_MISSING };
export type { TaxRegime };

/**
 * Fontes de receita da PRÓPRIA UnifiCard (D9.3/D9.5). Vocabulário GOVERNADO — mesmo conjunto do
 * CHECK `chk_tax_rules_platform_stream_vocab` da migration 4c-1. Registrado no manifesto governado;
 * o guard morde se divergir da fonte. Só existe em regra de plataforma (taxpayer_kind='platform').
 */
export const PLATFORM_REVENUE_STREAMS = [
  'marketplace_commission',
  'advertising',
  'own_tickets',
  'acquiring_fees',
  'physical_structures',
  'other',
] as const;
export type PlatformRevenueStream = (typeof PLATFORM_REVENUE_STREAMS)[number];

/** D9.3 — fiscalidade do actor/empresa vs. fiscalidade da própria UnifiCard (mesma infraestrutura). */
export const TAXPAYER_KINDS = ['actor', 'platform'] as const;
export type TaxpayerKind = (typeof TAXPAYER_KINDS)[number];

/** Esfera fiscal do tributo — subconjunto territorial da 2a (planet/neighborhood fora, ver 4c-1). */
export const TAX_SCOPE_LEVELS = ['country', 'state', 'city'] as const;
export type TaxScopeLevel = (typeof TAX_SCOPE_LEVELS)[number];

export const TAX_TYPE_STATUSES = ['active', 'retired'] as const;
export type TaxTypeStatus = (typeof TAX_TYPE_STATUSES)[number];

/**
 * FISCAL 4D-1 (DECISION-0167 §8) — modos de arredondamento GOVERNADOS da regra fiscal. Semânticas
 * matemáticas padrão; a ESCOLHA por regra é configuração do contribuinte/contador (Lei do Contador),
 * nunca comportamento oculto do código. Mesmo conjunto do CHECK chk_tax_rules_rounding_mode.
 * Draft pode nascer sem; ATIVAÇÃO exige (activateRule fail-closed). Zero default silencioso.
 */
export const ROUNDING_MODES = ['half_up', 'half_even', 'floor', 'ceil'] as const;
export type RoundingMode = (typeof ROUNDING_MODES)[number];

export const TAX_RULE_STATUSES = ['draft', 'active', 'deprecated'] as const;
export type TaxRuleStatus = (typeof TAX_RULE_STATUSES)[number];

// ── Entidades ────────────────────────────────────────────────────────────────
export interface TaxType {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description: string | null;
  scopeLevel: TaxScopeLevel;
  source: string | null;
  status: TaxTypeStatus;
  effectiveFrom: string;
  effectiveUntil: string | null;
  createdByActorId: string | null;
  createdAt: string;
}

export interface TaxRule {
  id: string;
  tenantId: string;
  taxTypeId: string;
  scopeLevel: TaxScopeLevel;
  taxpayerKind: TaxpayerKind;
  platformRevenueStream: PlatformRevenueStream | null;
  taxRegime: TaxRegime | null;
  conceptId: string | null;
  countryId: string | null;
  stateId: string | null;
  cityId: string | null;
  /** Alíquota em basis points INTEIROS — DADO versionado (D9.6.16). NUNCA usado para calcular aqui. */
  rateBps: number;
  /** 4D-1 (0167 §8): arredondamento GOVERNADO da regra. NULL só em draft; ativa sempre tem. */
  roundingMode: RoundingMode | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  source: string;
  configuredByActorId: string | null;
  status: TaxRuleStatus;
  version: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ── Inputs de escrita ────────────────────────────────────────────────────────
export interface CreateTaxTypeInput {
  tenantId: string;
  code: string;
  name: string;
  description?: string | null;
  scopeLevel: TaxScopeLevel;
  source?: string | null;
  createdByActorId?: string | null;
  effectiveFrom?: Date;
}

export interface CreateTaxRuleInput {
  tenantId: string;
  taxTypeId: string;
  scopeLevel: TaxScopeLevel;
  taxpayerKind: TaxpayerKind;
  platformRevenueStream?: PlatformRevenueStream | null;
  taxRegime?: TaxRegime | null;
  conceptId?: string | null;
  countryId: string;
  stateId?: string | null;
  cityId?: string | null;
  rateBps: number;
  /** 4D-1: opcional no DRAFT (rito permite nascer incompleto); a ATIVAÇÃO exige. */
  roundingMode?: RoundingMode | null;
  source: string;
  configuredByActorId?: string | null;
  effectiveFrom?: Date;
  metadata?: Record<string, unknown>;
}

// ── Contrato de resolução (LOCALIZA regra — NÃO calcula) ─────────────────────
export interface TaxRuleResolutionFilters {
  tenantId: string;
  taxpayerKind: TaxpayerKind;
  /** Regime do contribuinte; casa com regras do mesmo regime OU sem regime (NULL = qualquer). */
  taxRegime?: TaxRegime | null;
  countryId: string;
  stateId?: string | null;
  cityId?: string | null;
  conceptId?: string | null;
  platformRevenueStream?: PlatformRevenueStream | null;
  /** Data de vigência a considerar; default = agora. */
  onDate?: Date;
}

/**
 * Resultado da resolução. `found` = regras aplicáveis LOCALIZADAS (sem cálculo).
 * `fiscal_config_missing` = nenhuma regra governada existe para o contexto (D9.2) — o caller
 * decide alertar/bloquear fail-closed; NUNCA inventar alíquota nem provisão.
 */
export type FiscalRuleResolution =
  | { status: 'found'; rules: TaxRule[] }
  | { status: typeof FISCAL_CONFIG_MISSING; rules: []; reason: string };
