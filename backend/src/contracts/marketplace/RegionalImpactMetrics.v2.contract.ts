// CONTRATO v2 — RegionalImpactMetrics (nomenclatura canônica)
// v1: RegionalImpactMetrics.contract.ts (CONGELADO) usava `number` ambíguo para valores monetários
// §4.7 — fluxos regionais em centavos explícitos.

import type { Iso4217CurrencyCode } from './_canonical/money.types';

export interface RegionalImpactMetricsV2 {
  snapshotId: string;
  region: {
    country: string;
    state: string;
    city: string;
  };
  period: {
    year: number;
    month: number;
  };
  /** Soma dos montantes transacionados no período (centavos). */
  totalTransactionsAmountCents: number;
  totalOrdersCount: number;
  totalServicesCount: number;
  totalSubscriptionsActive: number;
  totalStoresActive: number;
  totalIndustrialProductsActive: number;
  /** Entrada no fundo regional (centavos). */
  regionalFundInflowCents: number;
  /** Saída do fundo regional (centavos). */
  regionalFundOutflowCents: number;
  /** Ticket médio em centavos: totalTransactionsAmountCents / totalOrdersCount quando orders > 0. */
  averageTicketAmountCents: number;
  currency: Iso4217CurrencyCode;
  generatedAt: string;
}