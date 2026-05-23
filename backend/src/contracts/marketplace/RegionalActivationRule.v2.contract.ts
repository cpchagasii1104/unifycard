// CONTRATO v2 — RegionalActivationRule (nomenclatura canônica)
// v1: RegionalActivationRule.contract.ts (CONGELADO, não alterar)
// §3.4 / §4.7 — sem `valueCents` genérico; limiares distintos para montante vs contagem.

import type { RateBps } from './_canonical/money.types';

/**
 * Regra de ativação regional — v2.
 * Gatilhos por volume monetário usam centavos explícitos; por contagem usam inteiro.
 */
export type RegionalActivationRuleV2 = {
  ruleId: string;
  region: {
    country: string;
    state: string;
    city: string;
  };
  trigger:
    | {
        metric: 'total_transactions_amount';
        operator: '>=' | '<=';
        /** Total transacionado no período, em centavos (§4.7). */
        thresholdAmountCents: number;
        currency: string;
        period: 'monthly';
      }
    | {
        metric: 'total_orders_count' | 'total_stores_active';
        operator: '>=' | '<=';
        thresholdCount: number;
        period: 'monthly';
      };
  action: {
    type: 'suggest_hub' | 'unlock_incentive' | 'enable_industry_onboarding';
    payload?: {
      incentiveType?: string;
      /** Teto em centavos quando o incentivo for monetário. */
      maxIncentiveAmountCents?: number;
      /** Percentual máximo do incentivo em bps, quando aplicável (§4.8). */
      maxIncentiveRateBps?: RateBps;
    };
  };
  status: 'active' | 'paused';
  createdAt: string;
};