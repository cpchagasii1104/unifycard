// backend/src/modules/marketplace/marketplace-fee-policy.ts
// DECISION-0140 (unidade: fee_rate_bps INTEGER / feeRateBps) + DECISION-0141 (schema-of-record:
// economic_policy_engine / economic_policy_lines.bps). Resolvedor ÚNICO da taxa UnifyCard/marketplace.
//
// "engine resolve; Bank materializa; método no máximo espelha." A taxa NUNCA vem de fee_percentage/100;
// vem SEMPRE de uma policy resolvida pelo economic_policy_engine, em basis points (bps), com o split
// calculado por `calculatePolicySplits` (floor(gross * bps / 10000)). Fail-closed: sem policy aplicável,
// fee = 0 (nenhuma taxa sem SSOT de policy) — nunca um fallback em fee_percentage.

import { economicPolicyEngineService } from '@modules/economy/policy-engine/economic-policy-engine.service';
import { logger } from '@core/observability/logger';

export interface MarketplaceFeeResolution {
  /** true só quando o engine resolveu uma policy aplicável. */
  resolved: boolean;
  /** soma dos splits que NÃO são `revenue_share` (a parte de taxa/plataforma/fundo), em cents (floor/bps). */
  feeAmountCents: number;
  /** gross - feeAmountCents. */
  netAmountCents: number;
  /** soma dos bps das linhas de taxa (não-`revenue_share`) — para snapshot auditável em bps. */
  feeRateBps: number;
  /** splits resolvidos (lineType/bps/amountCents) para snapshot auditável. NÃO é SSOT. */
  splits: Array<{ lineType: string; bps: number | null; amountCents: number }>;
  policyId: string | null;
  policyCode: string | null;
  policyVersion: number | null;
}

const empty = (grossAmountCents: number): MarketplaceFeeResolution => ({
  resolved: false,
  feeAmountCents: 0,
  netAmountCents: grossAmountCents,
  feeRateBps: 0,
  splits: [],
  policyId: null,
  policyCode: null,
  policyVersion: null,
});

/**
 * Resolve a taxa marketplace/UnifyCard via economic_policy_engine em bps.
 * Fail-closed: qualquer status != 'resolved' (ou erro do engine) ⇒ fee = 0 (sem fallback em fee_percentage).
 */
export async function resolveMarketplaceFeeViaPolicy(
  tenantId: string,
  grossAmountCents: number
): Promise<MarketplaceFeeResolution> {
  if (!Number.isInteger(grossAmountCents) || grossAmountCents <= 0) {
    return empty(grossAmountCents);
  }
  try {
    const result = await economicPolicyEngineService.resolveEconomicPolicy({
      tenantId,
      moduleContext: 'marketplace_payment',
      vertical: 'marketplace',
      transactionTime: new Date(),
    });
    if (result.status !== 'resolved' || !result.policy) {
      return empty(grossAmountCents);
    }
        // Base DECLARADA: o valor passado e o BRUTO da transacao de marketplace (o nome da variavel
    // ja diz, e a policy viva deste contexto usa gross_transaction — medido, nao suposto).
    // Se um dia esta policy passar a medir outra base, o motor RECUSA em vez de calcular errado.
    const calc = economicPolicyEngineService.calculatePolicySplits(
      grossAmountCents,
      result.lines,
      'gross_transaction'
    );
    const feeSplits = calc.splits.filter((s) => s.lineType !== 'revenue_share');
    const feeAmountCents = feeSplits.reduce((a, s) => a + s.amountCents, 0);
    const feeRateBps = feeSplits.reduce((a, s) => a + (s.bps ?? 0), 0);
    return {
      resolved: true,
      feeAmountCents,
      netAmountCents: grossAmountCents - feeAmountCents,
      feeRateBps,
      splits: calc.splits.map((s) => ({ lineType: s.lineType, bps: s.bps, amountCents: s.amountCents })),
      policyId: result.policy.id,
      policyCode: result.policy.policyCode,
      policyVersion: result.policy.version,
    };
  } catch (error) {
    // Fail-closed: nunca cobra taxa sem policy resolvida; não cai para fee_percentage.
    logger.warn('[marketplace-fee-policy] resolução de taxa via engine falhou; fee=0 (fail-closed)', {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return empty(grossAmountCents);
  }
}
