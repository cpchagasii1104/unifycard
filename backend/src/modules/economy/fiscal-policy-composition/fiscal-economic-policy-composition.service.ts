// backend/src/modules/economy/fiscal-policy-composition/fiscal-economic-policy-composition.service.ts
//
// FISCAL 4D-2 (DECISION-0178 D6/D7/D9/D10/D11) — FiscalEconomicPolicyCompositionService.
//
// Casa LEGÍTIMA da composição fiscal × policy: serviço interno, pré-financeiro, EVALUATION/READ-ONLY,
// NÃO-SSOT, SEM Bank, SEM caller monetário vivo (em 4d-2). Compõe AUTORIDADES EXISTENTES; não vira
// autoridade própria (PROHIBITED_STRUCTURES — autoridade não emerge de estrutura).
//
// Fluxo (D6): fatos econômicos governados → fiscal-provision UMA vez → EconomicPolicyEvaluationContext
// imutável → resolve/evalua policy (read-only) → seleção FECHADA de base → avaliação read-only.
//
// PROIBIDO (D6/§14): acessar bank_*, criar/mover dinheiro, criar/ativar policy, ler tax_rules
// diretamente, escolher rounding, recalcular imposto, chamar invoice, taxa hardcoded, religar payment.
// A ÚNICA escrita que o motor fiscal faz é a trilha append-only da PRÓPRIA decisão (4d-1, read-only
// sobre o mundo). Este serviço NÃO escreve nada.

import { fiscalProvisionService } from '@modules/fiscal-provision/fiscal-provision.service';
import type { FiscalConsumptionMode } from '@modules/fiscal-provision/fiscal-provision.types';
import { economicPolicyEngineService } from '@modules/economy/policy-engine/economic-policy-engine.service';
import type {
  EconomicPolicyLine,
  PolicyResolutionInput,
  PolicyResolutionStatus,
} from '@modules/economy/policy-engine/economic-policy.types';
import type { PlatformRevenueStream } from '@modules/fiscal/tax-catalog.types';
import {
  buildEconomicPolicyEvaluationContext,
  selectAppliesToBaseCents,
  type EconomicPolicyEvaluationContext,
} from './economic-policy-evaluation-context';

/** Modo de avaliação da POLICY (ortogonal ao consumptionMode FISCAL). */
export type PolicyEvaluationMode = 'preview' | 'monetary';

export interface FiscalEconomicPolicyCompositionInput {
  tenantId: string;
  moduleContext: string;
  /** Passada da plataforma (4d-1 só provê a passada 'platform' nesta fatia). */
  platformRevenueStream: PlatformRevenueStream;
  grossTransactionCents: number;
  commissionGrossCents: number;
  conceptId?: string | null;
  countryId: string;
  stateId?: string | null;
  cityId?: string | null;
  neighborhoodId?: string | null;
  occurredAt: Date;
  effectiveAt?: Date;
  currency: 'BRL';
  /** Modo FISCAL (0167 §7): informativo NÃO bloqueia; obrigatório fail-closed sem config. */
  fiscalConsumptionMode: FiscalConsumptionMode;
  /** Modo POLICY: preview = negativo honesto; monetary = fail-closed antes de qualquer alocação. */
  policyEvaluationMode: PolicyEvaluationMode;
  /** Identidade do evento fiscal (idempotência da trilha 4d-1). */
  sourceModule: string;
  sourceReferenceId: string;
  /** Seletores de resolução da policy (read-only; sem amount). */
  resolution?: Omit<PolicyResolutionInput, 'tenantId' | 'moduleContext'>;
}

export type EvaluatedLineStatus =
  | 'allocatable'
  | 'zero'
  | 'legacy_readonly_blocked'
  | 'fiscal_missing_blocked'
  | 'negative_preview';

export interface EvaluatedPolicyLine {
  lineId: string;
  lineType: EconomicPolicyLine['lineType'];
  destinationType: EconomicPolicyLine['destinationType'];
  appliesTo: EconomicPolicyLine['appliesTo'];
  base: 'gross_transaction' | 'commission_gross' | 'commission_distributable' | null;
  baseCents: number | null;
  bps: number | null;
  amountCents: number | null;
  status: EvaluatedLineStatus;
}

export type FiscalEconomicPolicyEvaluation =
  | {
      status: 'evaluated';
      context: EconomicPolicyEvaluationContext;
      resolutionStatus: PolicyResolutionStatus;
      lines: EvaluatedPolicyLine[];
      warnings: string[];
    }
  | {
      status: 'policy_unresolved';
      resolutionStatus: PolicyResolutionStatus;
      errorCode?: string;
      warnings: string[];
    };

class FiscalEconomicPolicyCompositionService {
  /**
   * Avalia (read-only) a composição fiscal × policy de UM evento econômico governado.
   * Chama o motor fiscal EXATAMENTE UMA vez. NÃO move dinheiro, NÃO escreve nada, NÃO toca Bank.
   */
  async evaluate(input: FiscalEconomicPolicyCompositionInput): Promise<FiscalEconomicPolicyEvaluation> {
    if (!Number.isInteger(input.grossTransactionCents) || input.grossTransactionCents < 0) {
      throw new Error('FISCAL_ECONOMIC_COMPOSITION_INVALID_GROSS: grossTransactionCents deve ser inteiro >= 0.');
    }
    if (!Number.isInteger(input.commissionGrossCents) || input.commissionGrossCents < 0) {
      throw new Error('FISCAL_ECONOMIC_COMPOSITION_INVALID_COMMISSION: commissionGrossCents deve ser inteiro >= 0.');
    }
    const effectiveAt = input.effectiveAt ?? input.occurredAt;
    const warnings: string[] = [];

    // (1) fiscal-provision UMA vez. mandatory+missing → o motor lança FISCAL_CONFIG_MISSING_MANDATORY (422).
    const outcome = await fiscalProvisionService.provisionPlatformCommission({
      tenantId: input.tenantId,
      sourceModule: input.sourceModule,
      sourceReferenceId: input.sourceReferenceId,
      taxpayerKind: 'platform',
      platformRevenueStream: input.platformRevenueStream,
      commissionGrossCents: input.commissionGrossCents,
      conceptId: input.conceptId ?? null,
      countryId: input.countryId,
      stateId: input.stateId ?? null,
      cityId: input.cityId ?? null,
      occurredAt: input.occurredAt,
      effectiveAt,
      currency: input.currency,
      consumptionMode: input.fiscalConsumptionMode,
      contractVersion: 1,
    });
    for (const w of outcome.warnings) warnings.push(w);

    const taxReserveCents = outcome.status === 'found' ? outcome.taxReserveCents : null;
    const commissionDistributableCents = outcome.status === 'found' ? outcome.commissionDistributableCents : null;
    const fiscalCalculationVersion = outcome.status === 'found' ? outcome.fiscalSnapshot.calculationVersion : 0;

    // (2) resolve policy (read-only). Comportamentos canônicos preservados (§19).
    const resolved = await economicPolicyEngineService.resolveEconomicPolicy({
      tenantId: input.tenantId,
      moduleContext: input.moduleContext,
      transactionTime: input.occurredAt,
      ...(input.resolution ?? {}),
    });
    if (resolved.status !== 'resolved' || !resolved.policy) {
      return { status: 'policy_unresolved', resolutionStatus: resolved.status, errorCode: resolved.errorCode, warnings };
    }

    // (3) contexto imutável uniforme (D8): economicPolicyId = economic_policies.id.
    const context = buildEconomicPolicyEvaluationContext({
      economicPolicyId: resolved.policy.id,
      fiscalStatus: outcome.status,
      fiscalSnapshot: outcome.status === 'found' ? outcome.fiscalSnapshot : null,
      fiscalCalculationVersion,
      countryId: input.countryId,
      stateId: input.stateId ?? null,
      cityId: input.cityId ?? null,
      neighborhoodId: input.neighborhoodId ?? null,
      occurredAt: input.occurredAt.toISOString(),
      effectiveAt: effectiveAt.toISOString(),
      grossTransactionCents: input.grossTransactionCents,
      commissionGrossCents: input.commissionGrossCents,
      taxReserveCents,
      commissionDistributableCents,
      currency: input.currency,
    });

    // (4) avaliação por linha: seleção FECHADA de base + fail-closed governado.
    const lines = this.evaluateLines(resolved.lines, context, input.policyEvaluationMode, warnings);

    return { status: 'evaluated', context, resolutionStatus: resolved.status, lines, warnings };
  }

  private evaluateLines(
    lines: EconomicPolicyLine[],
    ctx: EconomicPolicyEvaluationContext,
    mode: PolicyEvaluationMode,
    warnings: string[]
  ): EvaluatedPolicyLine[] {
    // Resultado por lineId (emitido na ORDEM original ao final). Bases positivas são acumuladas para
    // REUSAR a aritmética canônica (calculatePolicySplits) — sem duplicar o motor. Zero/negativo/legado/
    // missing são discriminados FORA do motor (que rejeita <=0 por design).
    const byId = new Map<string, EvaluatedPolicyLine>();
    const positiveGroups = new Map<string, { cents: number; base: 'gross_transaction' | 'commission_gross' | 'commission_distributable'; group: EconomicPolicyLine[] }>();

    for (const line of lines) {
      const sel = selectAppliesToBaseCents(line.appliesTo, ctx);
      const partial = { lineId: line.id, lineType: line.lineType, destinationType: line.destinationType, appliesTo: line.appliesTo, bps: line.bps };
      if (sel.kind === 'legacy_readonly') {
        // D3/D10: legado gross|net NUNCA é base viva de avaliação nova — histórico lê-se do snapshot.
        throw new Error(
          `ECONOMIC_POLICY_APPLIES_TO_LEGACY_READONLY_EVALUATION: linha ${line.id} usa base legada '${sel.value}' — ` +
            'histórico deve ser lido do snapshot já materializado, não reavaliado (DECISION-0178 D3).'
        );
      }
      if (sel.kind === 'fiscal_missing') {
        // D11: commission_distributable exige provisão fiscal válida. Monetária = fail-closed.
        if (mode === 'monetary') {
          throw Object.assign(
            new Error('FISCAL_CONFIG_MISSING_FOR_DISTRIBUTABLE: policy monetária exige provisão fiscal válida (DECISION-0178 D11).'),
            { statusCode: 422, code: 'FISCAL_CONFIG_MISSING_FOR_DISTRIBUTABLE' }
          );
        }
        byId.set(line.id, { ...partial, base: 'commission_distributable', baseCents: null, amountCents: null, status: 'fiscal_missing_blocked' });
        continue;
      }
      // sel.kind === 'amount'
      if (sel.cents < 0) {
        // D9: negativo. Monetária = fail-closed ANTES de qualquer alocação. Preview = honesto + warning.
        if (mode === 'monetary') {
          throw Object.assign(
            new Error(`COMMISSION_DISTRIBUTABLE_NEGATIVE: base '${sel.base}'=${sel.cents} negativa — nenhuma alocação (DECISION-0178 D9).`),
            { statusCode: 422, code: 'COMMISSION_DISTRIBUTABLE_NEGATIVE' }
          );
        }
        if (!warnings.includes('commission_distributable_negative')) warnings.push('commission_distributable_negative');
        byId.set(line.id, { ...partial, base: sel.base, baseCents: sel.cents, amountCents: null, status: 'negative_preview' });
        continue;
      }
      if (sel.cents === 0) {
        // D10: zero é resultado válido — linha zero preservada, honesta (não missing, não erro, não fallback).
        byId.set(line.id, { ...partial, base: sel.base, baseCents: 0, amountCents: 0, status: 'zero' });
        continue;
      }
      // base positiva: acumula para reusar a aritmética canônica por grupo de base.
      const key = `${sel.base}:${sel.cents}`;
      if (!positiveGroups.has(key)) positiveGroups.set(key, { cents: sel.cents, base: sel.base, group: [] });
      positiveGroups.get(key)!.group.push(line);
    }

    // Reusa calculatePolicySplits (D12: não duplicar motor) por grupo de base positiva.
    for (const { cents, base, group } of positiveGroups.values()) {
      // 🔴 A BASE VIAJA (2026-08-05). Este agrupador SEMPRE soube qual base cada grupo mede — é a
      // chave do próprio agrupamento (`sel.base`) — e não a passava ao motor, que calculava cego.
      // Agora passa: se um grupo for montado com base divergente da das suas linhas, o motor
      // RECUSA (POLICY_BASE_MISMATCH) em vez de aplicar o percentual sobre a régua errada.
      const result = economicPolicyEngineService.calculatePolicySplits(cents, group, base);
      // calculatePolicySplits reordena por priority; casa split↔linha por id do CalculatedEconomicSplit
      // não existe, então mapeamos pela MESMA ordenação determinística (priority asc, estável).
      const sortedGroup = [...group].sort((a, b) => a.priority - b.priority);
      for (let i = 0; i < sortedGroup.length; i++) {
        const line = sortedGroup[i];
        const split = result.splits[i];
        byId.set(line.id, {
          lineId: line.id,
          lineType: line.lineType,
          destinationType: line.destinationType,
          appliesTo: line.appliesTo,
          base,
          baseCents: cents,
          bps: line.bps,
          amountCents: split.amountCents,
          status: 'allocatable',
        });
      }
    }

    return lines.map((l) => byId.get(l.id)!).filter(Boolean);
  }
}

export const fiscalEconomicPolicyCompositionService = new FiscalEconomicPolicyCompositionService();
