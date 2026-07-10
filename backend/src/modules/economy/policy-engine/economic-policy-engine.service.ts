// backend/src/modules/economy/policy-engine/economic-policy-engine.service.ts
//
// Resolver puro do Economic Policy Engine (PE-1, 2026-05-26).
//
// 3 funções públicas:
//   1. resolveEconomicPolicy(input)         — escolhe policy + lines + pass.
//   2. calculatePolicySplits(amount, ...)   — cálculo BPS determinístico
//                                              (floor + drift to revenue_share).
//   3. applyAccessPassOverride(...)         — sobrepõe linhas conforme pass.
//
// Decisões Clayton aplicadas:
//   K_pe_5 — BPS inteiro, sem float.
//   K_pe_7 — drift no revenue_share[0]; sem revenue_share = erro fail-closed.
//   K_pe_8 — specificity DESC, priority DESC, effective_from DESC;
//            empate real no topo = POLICY_AMBIGUITY; nenhuma = POLICY_NOT_FOUND.
//   K_pe_10 — log de resolução em economic_policy_resolution_logs (best-effort).
//
// NÃO altera bank_ledger. NÃO emite event_outbox. NÃO toca actor_wallet.
// NÃO liga em service_execution (frente PE-3 fará isso).

import { economicPolicyRepository } from './economic-policy.repository';
import type {
  EconomicPolicy,
  EconomicPolicyLine,
  PolicyResolutionInput,
  ResolvedEconomicPolicy,
  CalculatedEconomicSplit,
  PolicyCalculationResult,
  ActorAccessPass,
  AccessPassProduct,
} from './economic-policy.types';

// Lista canônica de seletores opcionais (NULL = any). Specificity =
// count(seletores NOT NULL na policy).
const SELECTOR_FIELDS: Array<keyof EconomicPolicy> = [
  'vertical',
  'actorType',
  'serviceType',
  'pricingModel',
  'settlementFlow',
  'country',
  'region',
  'city',
  'categoryId',
  'channel',
  'campaignId',
];

function computeSpecificity(policy: EconomicPolicy): number {
  let count = 0;
  for (const f of SELECTOR_FIELDS) {
    if (policy[f] !== null && policy[f] !== undefined) count++;
  }
  return count;
}

/**
 * Compara duas policies para ordenação descendente:
 *   specificity DESC → priority DESC → effective_from DESC.
 * Retorna 0 se EMPATE REAL (mesmos 3 critérios).
 */
function comparePolicies(a: EconomicPolicy, b: EconomicPolicy): number {
  const sa = computeSpecificity(a);
  const sb = computeSpecificity(b);
  if (sa !== sb) return sb - sa;
  if (a.priority !== b.priority) return b.priority - a.priority;
  const fa = new Date(a.effectiveFrom).getTime();
  const fb = new Date(b.effectiveFrom).getTime();
  if (fa !== fb) return fb - fa;
  return 0;
}

class EconomicPolicyEngineService {
  /**
   * Resolve a policy aplicável + lines + access pass ativo (se houver).
   *
   * Log de resolução é best-effort (não trava em erro de gravação).
   */
  async resolveEconomicPolicy(input: PolicyResolutionInput): Promise<ResolvedEconomicPolicy> {
    if (!input.tenantId || !input.moduleContext) {
      const result: ResolvedEconomicPolicy = {
        status: 'error',
        policy: null,
        lines: [],
        appliedAccessPass: null,
        appliedAccessPassProduct: null,
        errorCode: 'INVALID_INPUT',
        errorMessage: 'tenantId e moduleContext são obrigatórios',
      };
      return result;
    }

    const transactionTime = input.transactionTime ?? new Date();
    const eligible = await economicPolicyRepository.findEligiblePolicies(input, transactionTime);

    if (eligible.length === 0) {
      await economicPolicyRepository.insertResolutionLog({
        tenantId: input.tenantId,
        policyId: null,
        actorId: input.actorId ?? null,
        moduleContext: input.moduleContext,
        resolutionStatus: 'not_found',
        inputJson: input as unknown as Record<string, unknown>,
        errorCode: 'POLICY_NOT_FOUND',
      });
      return {
        status: 'not_found',
        policy: null,
        lines: [],
        appliedAccessPass: null,
        appliedAccessPassProduct: null,
        errorCode: 'POLICY_NOT_FOUND',
        errorMessage: 'Nenhuma policy elegível para o contexto fornecido',
      };
    }

    const sorted = [...eligible].sort(comparePolicies);

    // Detecta empate real no topo: comparePolicies retorna 0 para top1
    // e top2.
    if (sorted.length >= 2 && comparePolicies(sorted[0]!, sorted[1]!) === 0) {
      await economicPolicyRepository.insertResolutionLog({
        tenantId: input.tenantId,
        policyId: null,
        actorId: input.actorId ?? null,
        moduleContext: input.moduleContext,
        resolutionStatus: 'ambiguous',
        inputJson: input as unknown as Record<string, unknown>,
        errorCode: 'POLICY_AMBIGUITY',
      });
      return {
        status: 'ambiguous',
        policy: null,
        lines: [],
        appliedAccessPass: null,
        appliedAccessPassProduct: null,
        errorCode: 'POLICY_AMBIGUITY',
        errorMessage:
          'Múltiplas policies igualmente específicas para o contexto — fail-closed',
      };
    }

    const winner = sorted[0]!;
    const rawLines = await economicPolicyRepository.findPolicyLines(input.tenantId, winner.id);

    // Tentar carregar access pass ativo do actor, se actorId fornecido.
    let appliedPass: ActorAccessPass | null = null;
    let appliedProduct: AccessPassProduct | null = null;
    if (input.actorId) {
      const passes = await economicPolicyRepository.findActiveAccessPasses(
        input.tenantId,
        input.actorId,
        input.moduleContext,
        input.vertical,
        input.country,
        input.region,
        input.city,
        transactionTime
      );
      if (passes.length > 0) {
        appliedPass = passes[0]!.pass;
        appliedProduct = passes[0]!.product;
      }
    }

    const lines = this.applyAccessPassOverride(rawLines, appliedProduct);

    await economicPolicyRepository.insertResolutionLog({
      tenantId: input.tenantId,
      policyId: winner.id,
      actorId: input.actorId ?? null,
      moduleContext: input.moduleContext,
      resolutionStatus: 'resolved',
      inputJson: input as unknown as Record<string, unknown>,
      selectedPolicyJson: winner as unknown as Record<string, unknown>,
      calculatedSplitsJson: { linesCount: lines.length } as Record<string, unknown>,
      accessPassId: appliedPass?.id ?? null,
    });

    return {
      status: 'resolved',
      policy: winner,
      lines,
      appliedAccessPass: appliedPass,
      appliedAccessPassProduct: appliedProduct,
    };
  }

  /**
   * Aplica override de access pass nas linhas:
   *   - commissionOverrideBps SUBSTITUI o bps da linha 'platform_fee'.
   *   - Drift volta para revenue_share[0] no calculate.
   *   - Se override=0, fee fica 0 e revenue_share absorve.
   *
   * Outras linhas (regional_fund, reserve, referral, group, rca) NÃO
   * são alteradas por pass. Decisão de produto futura pode estender.
   */
  applyAccessPassOverride(
    lines: EconomicPolicyLine[],
    appliedProduct: AccessPassProduct | null
  ): EconomicPolicyLine[] {
    if (!appliedProduct || appliedProduct.commissionOverrideBps === null) {
      return lines;
    }
    return lines.map((line) =>
      line.lineType === 'platform_fee'
        ? { ...line, bps: appliedProduct.commissionOverrideBps }
        : line
    );
  }

  /**
   * Calcula splits canônicos a partir de amountCents + lines.
   *
   * Algoritmo (K_pe_7):
   *   1. Para cada line (priority asc):
   *      - se bps != null:        line.amountCents = floor(amount * bps / 10000)
   *      - se fixedAmount != null: line.amountCents = fixedAmount
   *   2. drift = amountCents - Σ(line.amountCents).
   *   3. Se drift != 0: aplicar drift à PRIMEIRA linha revenue_share.
   *      Se nenhuma revenue_share existir: erro DRIFT_NO_REVENUE_SHARE.
   *   4. Se alguma linha resultar amountCents < 0 ou Σ != amountCents:
   *      erro CALCULATION_INVALID.
   *
   * Sem float em runtime. Math.floor sobre BigInt-equivalent (integer division).
   */
  calculatePolicySplits(
    amountCents: number,
    lines: EconomicPolicyLine[]
  ): PolicyCalculationResult {
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new Error('calculatePolicySplits: amountCents deve ser inteiro positivo');
    }
    if (lines.length === 0) {
      throw new Error('calculatePolicySplits: nenhuma linha fornecida');
    }

    const sortedLines = [...lines].sort((a, b) => a.priority - b.priority);
    const calculated: CalculatedEconomicSplit[] = [];
    let revenueShareIndex: number | null = null;

    for (const line of sortedLines) {
      let lineAmount: number;
      if (line.bps !== null && line.bps !== undefined) {
        // Integer arithmetic: floor(amount * bps / 10000).
        lineAmount = Math.floor((amountCents * line.bps) / 10000);
      } else if (line.fixedAmountCents !== null && line.fixedAmountCents !== undefined) {
        lineAmount = line.fixedAmountCents;
      } else {
        throw new Error(
          `calculatePolicySplits: linha ${line.id} sem bps nem fixedAmountCents`
        );
      }

      if (line.lineType === 'revenue_share' && revenueShareIndex === null) {
        revenueShareIndex = calculated.length;
      }

      calculated.push({
        lineType: line.lineType,
        destinationType: line.destinationType,
        destinationKey: line.destinationKey,
        regionalOriginBasis: line.regionalOriginBasis,
        regionalLevel: line.regionalLevel,
        bps: line.bps,
        amountCents: lineAmount,
        metadata: line.metadata,
      });
    }

    const sumCents = calculated.reduce((s, x) => s + x.amountCents, 0);
    let drift = amountCents - sumCents;

    if (drift !== 0) {
      if (revenueShareIndex === null) {
        throw new Error(
          'DRIFT_NO_REVENUE_SHARE: drift de arredondamento sem linha revenue_share para absorver'
        );
      }
      calculated[revenueShareIndex]!.amountCents += drift;
      drift = amountCents - calculated.reduce((s, x) => s + x.amountCents, 0);
    }

    // Validações finais.
    if (drift !== 0) {
      throw new Error('CALCULATION_INVALID: drift residual após correção');
    }
    for (const split of calculated) {
      if (split.amountCents < 0) {
        throw new Error(
          `CALCULATION_INVALID: split ${split.lineType} resultou em amountCents negativo`
        );
      }
    }

    return {
      totalAmountCents: amountCents,
      splits: calculated,
    };
  }
}

export const economicPolicyEngineService = new EconomicPolicyEngineService();
