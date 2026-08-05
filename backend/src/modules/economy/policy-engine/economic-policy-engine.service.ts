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
  EconomicPolicyLineAppliesTo,
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
//
// FATIA 0 (2026-07-27, frente economic-policy): country/region/city (TEXT livre) DEPRECATED —
// substituídos por countryId/stateId/cityId (Location Core governado, FK). Specificity NUNCA
// mais conta os campos TEXT (ver COMMENT ON COLUMN da migration 20260727100000).
const SELECTOR_FIELDS: Array<keyof EconomicPolicy> = [
  'vertical',
  'actorType',
  'serviceType',
  'pricingModel',
  'settlementFlow',
  'countryId',
  'stateId',
  'cityId',
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
    lines: EconomicPolicyLine[],
    /**
     * 🔴 QUE BASE É ESTE `amountCents`? — OBRIGATÓRIO desde 2026-08-05 (GO de Clayton).
     *
     * Até aqui o motor **ignorava `applies_to`** (medido: zero ocorrências neste arquivo) e
     * aplicava todo bps sobre o valor recebido, fosse ele qual fosse. `DECISION-0194` já
     * nomeava isso como *"arma carregada para a primeira policy que use outra base"*.
     *
     * A primeira chegou: Clayton decidiu que a INDICAÇÃO incide sobre `commission_gross` —
     * percentual sobre a COMISSÃO, não sobre o bruto. Com o motor cego, uma linha de 10%
     * pagaria 10% do **valor total** em vez de 10% dos 20% de comissão: **cinco vezes mais**,
     * sem erro nenhum aparecendo. Não estava acontecendo porque as travas de runtime
     * financeiro estão OFF — o erro nasceria no dia de ligar, que é o dia em que ninguém
     * lembraria deste aviso.
     *
     * Este parâmetro é o que fecha o buraco: quem chama DECLARA o que está passando, e o
     * motor recusa calcular se a declaração divergir da base da policy (D4: divergência é
     * **fail-closed**, nunca correção silenciosa).
     */
    baseOfAmount: EconomicPolicyLineAppliesTo
  ): PolicyCalculationResult {
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new Error('calculatePolicySplits: amountCents deve ser inteiro positivo');
    }
    if (lines.length === 0) {
      throw new Error('calculatePolicySplits: nenhuma linha fornecida');
    }

    // ── D2: UMA BASE POR POLICY. MISTURAR É PROIBIDO. ──
    // Com base única, `sum(bps) = 10000` volta a significar conservação REAL de UM valor, e o
    // drift residual volta a ser o que foi desenhado para ser: centavo de arredondamento. Sem
    // esta trava, o drift confunde "parcela de outra régua" com "sobra de centavo" e corrompe
    // dinheiro SEM LANÇAR ERRO — que é a pior forma possível.
    const basesDeclaradas = Array.from(new Set(lines.map((l) => l.appliesTo)));
    if (basesDeclaradas.length > 1) {
      throw new Error(
        `POLICY_MIXED_BASE: a policy mistura bases (${basesDeclaradas.join(', ')}). ` +
        'DECISION-0194 D2 proíbe: uma base por policy. O desenho correto para o que parece ' +
        'exigir mistura é DUAS ETAPAS ENCADEADAS (D3), cada uma fechando 100% do próprio bolo.'
      );
    }

    // ── D4: a base declarada tem que ser a base do valor recebido ──
    const baseDaPolicy = basesDeclaradas[0];
    if (baseDaPolicy !== baseOfAmount) {
      throw new Error(
        `POLICY_BASE_MISMATCH: a policy mede '${baseDaPolicy}' e o valor entregue foi declarado ` +
        `como '${baseOfAmount}'. Calcular assim mesmo aplicaria o percentual sobre a régua errada ` +
        '— exatamente o defeito que DECISION-0194 D4 manda tratar como fail-closed, nunca como ' +
        'correção silenciosa.'
      );
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
