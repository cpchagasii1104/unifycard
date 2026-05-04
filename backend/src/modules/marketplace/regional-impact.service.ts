// backend/src/modules/marketplace/regional-impact.service.ts
// FASE X — Bloco 2: Regional Impact Snapshots (base para regras e incentivos)

import type { RegionalImpactMetrics } from '@contracts/marketplace/RegionalImpactMetrics.contract';
import { regionalImpactRepository, type RegionalImpactSnapshotRow, type UpsertSnapshotInput } from './regional-impact.repository';

export interface RegionInput {
  country: string;
  state: string;
  city: string;
}

function rowToRegionalImpactMetrics(row: RegionalImpactSnapshotRow): RegionalImpactMetrics {
  const totalVolume = Number(row.total_volume_cents);
  const totalTransactions = row.total_transactions;
  const [yearStr, monthStr] = row.period.split('-');
  const year = parseInt(yearStr ?? '0', 10);
  const month = parseInt(monthStr ?? '0', 10);
  const totalTransactionsAmount = totalVolume / 100;
  const totalOrdersCount = totalTransactions;
  const averageTicket = totalOrdersCount > 0 ? totalTransactionsAmount / totalOrdersCount : 0;
  return {
    snapshotId: row.id,
    region: { country: row.country, state: row.state, city: row.city },
    period: { year, month },
    totalTransactionsAmount,
    totalOrdersCount,
    totalServicesCount: 0,
    totalSubscriptionsActive: 0,
    totalStoresActive: 0,
    totalIndustrialProductsActive: 0,
    regionalFundInflow: Number(row.regional_fund_inflow_cents) / 100,
    regionalFundOutflow: Number(row.regional_fund_outflow_cents) / 100,
    averageTicket,
    currency: 'BRL',
    generatedAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

class RegionalImpactService {
  async getLatestRegionalImpact(tenantId: string, region: RegionInput): Promise<RegionalImpactMetrics | null> {
    const row = await regionalImpactRepository.getLatestSnapshot(tenantId, region);
    if (!row) return null;
    return rowToRegionalImpactMetrics(row);
  }

  async computeSnapshotFromData(
    tenantId: string,
    region: RegionInput,
    period: string,
    data: {
      totalVolumeCents?: number;
      totalTransactions?: number;
      regionalFundInflowCents?: number;
      regionalFundOutflowCents?: number;
    }
  ): Promise<RegionalImpactMetrics> {
    const row = await regionalImpactRepository.upsertSnapshot(tenantId, {
      country: region.country,
      state: region.state,
      city: region.city,
      period,
      totalVolumeCents: data.totalVolumeCents ?? 0,
      totalTransactions: data.totalTransactions ?? 0,
      regionalFundInflowCents: data.regionalFundInflowCents ?? 0,
      regionalFundOutflowCents: data.regionalFundOutflowCents ?? 0,
    });
    return rowToRegionalImpactMetrics(row);
  }
}

export const regionalImpactService = new RegionalImpactService();
