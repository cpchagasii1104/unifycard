// Única camada que conhece RegionalImpactMetrics v1 + v2 — não misturar shapes noutros serviços.
// Convenção: valores monetários em v1 já são centavos inteiros (como snapshot interno legado).

import type { RegionalImpactMetrics } from '../RegionalImpactMetrics.contract';
import type { RegionalImpactMetricsV2 } from '../RegionalImpactMetrics.v2.contract';
import { asIso4217CurrencyCode } from '../_canonical/money.types';

export function regionalImpactMetricsV1ToV2(v1: RegionalImpactMetrics): RegionalImpactMetricsV2 {
  return {
    snapshotId: v1.snapshotId,
    region: v1.region,
    period: v1.period,
    totalTransactionsAmountCents: Math.round(v1.totalTransactionsAmount),
    totalOrdersCount: v1.totalOrdersCount,
    totalServicesCount: v1.totalServicesCount,
    totalSubscriptionsActive: v1.totalSubscriptionsActive,
    totalStoresActive: v1.totalStoresActive,
    totalIndustrialProductsActive: v1.totalIndustrialProductsActive,
    regionalFundInflowCents: Math.round(v1.regionalFundInflow),
    regionalFundOutflowCents: Math.round(v1.regionalFundOutflow),
    averageTicketAmountCents: Math.round(v1.averageTicket),
    currency: asIso4217CurrencyCode(v1.currency),
    generatedAt: v1.generatedAt,
  };
}