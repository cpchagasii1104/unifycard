// Única camada que conhece RegionalActivationRule v1 + v2.
// v1 usava valueCents para todas as métricas; v2 separa montante (centavos) vs contagem.

import type { RegionalActivationRule } from '../RegionalActivationRule.contract';
import type { RegionalActivationRuleV2 } from '../RegionalActivationRule.v2.contract';
import { asIso4217CurrencyCode } from '../_canonical/money.types';

/** Moeda por defeito quando v1 não distinguia métrica monetária (ajustar por tenant se necessário). */
const DEFAULT_TRIGGER_CURRENCY = 'BRL';

export function regionalActivationRuleV1ToV2(v1: RegionalActivationRule): RegionalActivationRuleV2 {
  const base = {
    ruleId: v1.ruleId,
    region: v1.region,
    action: {
      type: v1.action.type,
      payload: v1.action.payload
        ? {
            incentiveType: v1.action.payload.incentiveType,
            maxIncentiveAmountCents:
              v1.action.payload.maxAmount != null
                ? Math.round(v1.action.payload.maxAmount)
                : undefined,
          }
        : undefined,
    },
    status: v1.status,
    createdAt: v1.createdAt,
  };

  if (v1.trigger.metric === 'total_transactions_amount') {
    return {
      ...base,
      trigger: {
        metric: 'total_transactions_amount',
        operator: v1.trigger.operator,
        thresholdAmountCents: Math.round(v1.trigger.valueCents),
        currency: asIso4217CurrencyCode(DEFAULT_TRIGGER_CURRENCY),
        period: v1.trigger.period,
      },
    };
  }

  return {
    ...base,
    trigger: {
      metric: v1.trigger.metric,
      operator: v1.trigger.operator,
      thresholdCount: Math.round(v1.trigger.valueCents),
      period: v1.trigger.period,
    },
  };
}