// backend/src/modules/economy/fiscal-policy-composition/economic-policy-evaluation-context.ts
//
// FISCAL 4D-2 (DECISION-0178 D8/D11/D12) — CONTEXTO DE AVALIAÇÃO econômica IMUTÁVEL e a SELEÇÃO
// GOVERNADA de base por applies_to. READ MODEL, não SSOT.
//
// Todas as linhas da MESMA avaliação compartilham UM contexto: mesmo economic_policies.id, mesmo
// snapshot fiscal, mesma jurisdição, mesmos tempos, as mesmas 3 bases, mesma moeda e mesma
// calculation version. Valores monetários em centavos inteiros. Nenhum campo é recalculado pelo
// policy engine — os fatos econômicos e fiscais chegam PRONTOS (fiscal-provision 4d-1).
//
// Fronteira: NÃO existe tabela economic_policy_versions — "versão da policy" = economic_policies.id.

import type { FiscalSnapshot } from '@modules/fiscal-provision/fiscal-provision.types';
import type { EconomicPolicyAppliesToPhysical } from '@modules/economy/policy-engine/economic-policy.types';
import { ECONOMIC_POLICY_APPLIES_TO_LEGACY_READONLY } from '@modules/economy/policy-engine/economic-policy.types';

/** Status fiscal propagado da passada 4d-1 (nunca inventado). */
export type FiscalProvisionStatus = 'found' | 'fiscal_config_missing';

/**
 * Contexto imutável de UMA avaliação econômica (D8). Congelado após construção; nenhum consumidor
 * pode mutar os fatos-base. `economicPolicyId` é SEMPRE economic_policies.id (a LINHA-versão).
 */
export interface EconomicPolicyEvaluationContext {
  readonly economicPolicyId: string;
  readonly fiscalStatus: FiscalProvisionStatus;
  /** snapshot fiscal imutável 4d-1 (identidade da provisão); null quando fiscal_config_missing informativo. */
  readonly fiscalSnapshot: FiscalSnapshot | null;
  readonly fiscalCalculationVersion: number;
  readonly countryId: string;
  readonly stateId: string | null;
  readonly cityId: string | null;
  readonly neighborhoodId: string | null;
  readonly occurredAt: string;
  readonly effectiveAt: string;
  /** Fatos econômicos (centavos inteiros). */
  readonly grossTransactionCents: number;
  readonly commissionGrossCents: number;
  /** taxReserve/distributable são null quando fiscal_config_missing (não inventar reserva). */
  readonly taxReserveCents: number | null;
  readonly commissionDistributableCents: number | null;
  readonly currency: 'BRL';
}

export interface BuildEvaluationContextInput {
  economicPolicyId: string;
  fiscalStatus: FiscalProvisionStatus;
  fiscalSnapshot: FiscalSnapshot | null;
  fiscalCalculationVersion: number;
  countryId: string;
  stateId?: string | null;
  cityId?: string | null;
  neighborhoodId?: string | null;
  occurredAt: string;
  effectiveAt: string;
  grossTransactionCents: number;
  commissionGrossCents: number;
  taxReserveCents: number | null;
  commissionDistributableCents: number | null;
  currency: 'BRL';
}

const assertIntCents = (label: string, v: number): void => {
  if (!Number.isInteger(v)) {
    throw new Error(`ECONOMIC_POLICY_EVALUATION_CONTEXT_NON_INTEGER: ${label} deve ser centavos inteiros.`);
  }
};

/** Constrói o contexto e o CONGELA (imutável). Valida integralidade de centavos. */
export function buildEconomicPolicyEvaluationContext(
  input: BuildEvaluationContextInput
): EconomicPolicyEvaluationContext {
  assertIntCents('grossTransactionCents', input.grossTransactionCents);
  assertIntCents('commissionGrossCents', input.commissionGrossCents);
  if (input.taxReserveCents !== null) assertIntCents('taxReserveCents', input.taxReserveCents);
  if (input.commissionDistributableCents !== null) assertIntCents('commissionDistributableCents', input.commissionDistributableCents);
  // coerência do status: found ⇒ reserva/distribuível presentes; missing ⇒ ambos null (nunca inventar).
  if (input.fiscalStatus === 'found' && (input.taxReserveCents === null || input.commissionDistributableCents === null)) {
    throw new Error('ECONOMIC_POLICY_EVALUATION_CONTEXT_INCOHERENT: fiscal found sem reserva/distribuível.');
  }
  if (input.fiscalStatus === 'fiscal_config_missing' && (input.taxReserveCents !== null || input.commissionDistributableCents !== null)) {
    throw new Error('ECONOMIC_POLICY_EVALUATION_CONTEXT_INCOHERENT: fiscal_config_missing com reserva/distribuível inventados.');
  }
  return Object.freeze({
    economicPolicyId: input.economicPolicyId,
    fiscalStatus: input.fiscalStatus,
    fiscalSnapshot: input.fiscalSnapshot,
    fiscalCalculationVersion: input.fiscalCalculationVersion,
    countryId: input.countryId,
    stateId: input.stateId ?? null,
    cityId: input.cityId ?? null,
    neighborhoodId: input.neighborhoodId ?? null,
    occurredAt: input.occurredAt,
    effectiveAt: input.effectiveAt,
    grossTransactionCents: input.grossTransactionCents,
    commissionGrossCents: input.commissionGrossCents,
    taxReserveCents: input.taxReserveCents,
    commissionDistributableCents: input.commissionDistributableCents,
    currency: input.currency,
  });
}

/** Resultado da seleção de base (D12): discriminado, nunca alias, nunca fallback. */
export type AppliesToBaseSelection =
  | { kind: 'amount'; base: 'gross_transaction' | 'commission_gross' | 'commission_distributable'; cents: number }
  | { kind: 'legacy_readonly'; value: 'gross' | 'net' }
  | { kind: 'fiscal_missing'; base: 'commission_distributable' };

/**
 * Seleção FECHADA de base por applies_to (D12). Sem fallback, sem base default, sem inferência por
 * line_type/valor, sem tax_reserve (que nem é valor de applies_to). Legado gross|net → discriminado
 * read-only (o caller decide fail-closed). commission_distributable com fiscal ausente → discriminado
 * fiscal_missing (não vira zero nem gross).
 */
export function selectAppliesToBaseCents(
  appliesTo: EconomicPolicyAppliesToPhysical,
  ctx: EconomicPolicyEvaluationContext
): AppliesToBaseSelection {
  if ((ECONOMIC_POLICY_APPLIES_TO_LEGACY_READONLY as readonly string[]).includes(appliesTo)) {
    return { kind: 'legacy_readonly', value: appliesTo as 'gross' | 'net' };
  }
  switch (appliesTo) {
    case 'gross_transaction':
      return { kind: 'amount', base: 'gross_transaction', cents: ctx.grossTransactionCents };
    case 'commission_gross':
      return { kind: 'amount', base: 'commission_gross', cents: ctx.commissionGrossCents };
    case 'commission_distributable':
      if (ctx.commissionDistributableCents === null) return { kind: 'fiscal_missing', base: 'commission_distributable' };
      return { kind: 'amount', base: 'commission_distributable', cents: ctx.commissionDistributableCents };
    default: {
      // exaustivo: qualquer valor fora do vocabulário físico é erro estrutural (nunca alias silencioso).
      const never: never = appliesTo as never;
      throw new Error(`ECONOMIC_POLICY_APPLIES_TO_UNKNOWN_BASE: '${String(never)}' fora do vocabulário físico.`);
    }
  }
}
