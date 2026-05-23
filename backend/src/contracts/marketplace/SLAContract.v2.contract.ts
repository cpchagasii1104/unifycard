// CONTRATO v2 — SLAContract (nomenclatura canônica)
// v1: SLAContract.contract.ts (CONGELADO) — valueCents com dupla semântica; percentuais sem bps
// §4.8 — métricas de taxa em bps; §4.7 — penalidade fixa em centavos.

import type { RateBps } from './_canonical/money.types';

export type SlaPenaltyRedirect = 'regional_fund' | 'customer' | 'platform';

/** Penalidade: desconto fixo (centavos) OU percentual sobre split (bps), nunca no mesmo campo. */
export type SlaPenaltyV2 =
  | { type: 'fixed'; penaltyFixedCents: number; penaltyRateBps: 0; redirectTo: SlaPenaltyRedirect }
  | { type: 'percentage'; penaltyFixedCents: 0; penaltyRateBps: RateBps; redirectTo: SlaPenaltyRedirect };

export interface SLAContractV2 {
  slaId: string;
  actorType: 'store' | 'hub' | 'industry' | 'service_provider';
  actorId: string;
  metrics: {
    fulfillmentTime: {
      targetHours: number;
      maxHours: number;
      unit: 'hours';
    };
    cancellationRate: {
      targetRateBps: RateBps;
      maxRateBps: RateBps;
      unit: 'bps';
    };
    disputeRate: {
      targetRateBps: RateBps;
      maxRateBps: RateBps;
      unit: 'bps';
    };
  };
  thresholds: {
    warning: {
      fulfillmentTimeHours: number;
      cancellationRateBps: RateBps;
      disputeRateBps: RateBps;
    };
    violation: {
      fulfillmentTimeHours: number;
      cancellationRateBps: RateBps;
      disputeRateBps: RateBps;
    };
  };
  penalties: {
    fulfillmentTimeViolation: SlaPenaltyV2;
    cancellationRateViolation: SlaPenaltyV2;
    disputeRateViolation: SlaPenaltyV2;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}