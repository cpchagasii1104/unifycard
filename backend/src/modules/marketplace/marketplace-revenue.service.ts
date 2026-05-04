// backend/src/modules/marketplace/marketplace.service.revenue.ts
// Módulo Revenue / Financial Flow — snapshots de receita e fluxo financeiro regional

import type { MarketplaceService } from './marketplace.service';
import type { RevenueSnapshot, RegionalFinancialFlow } from '@contracts/marketplace';
import { regionalFundService } from './regional-fund.service';
import { marketplaceLogger } from './marketplace.logger';

export class MarketplaceRevenueModule {
  private readonly revenueSnapshots: Map<string, RevenueSnapshot> = new Map();

  constructor(private readonly facade: MarketplaceService) {}

  getRevenueSnapshotsMap(): Map<string, RevenueSnapshot> {
    return this.revenueSnapshots;
  }

  generateRevenueSnapshot(region: { country: string; state: string; city: string }, period: {
    year: number;
    month: number;
  }): RevenueSnapshot {
    const existingSnapshot = Array.from(this.revenueSnapshots.values()).find(
      s =>
        s.region.country === region.country &&
        s.region.state === region.state &&
        s.region.city === region.city &&
        s.period.year === period.year &&
        s.period.month === period.month
    );

    if (existingSnapshot) {
      throw new Error(
        `Snapshot de receita já existe para ${region.city}/${region.state} - ${period.month}/${period.year}. ` +
        `Snapshots são imutáveis.`
      );
    }

    const snapshotId = `revenue-snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const snapshot: RevenueSnapshot = {
      snapshotId,
      region,
      period,
      revenues: {
        transaction: {
          totalAmountCents: 0,
          platformRevenueCents: 0,
          regionalFundRevenueCents: 0,
          infrastructureCostCents: 0,
        },
        b2b: {
          totalAmountCents: 0,
          platformRevenueCents: 0,
          regionalFundRevenueCents: 0,
        },
        subscription: {
          totalAmountCents: 0,
          platformRevenueCents: 0,
          regionalFundRevenueCents: 0,
        },
        terminal: {
          totalAmountCents: 0,
          platformRevenueCents: 0,
          regionalFundRevenueCents: 0,
          infrastructureCostCents: 0,
        },
        logistics: {
          totalAmountCents: 0,
          platformRevenueCents: 0,
          regionalFundRevenueCents: 0,
        },
      },
      totalTransactedCents: 0,
      totalFeesCents: 0,
      totalPlatformRevenueCents: 0,
      totalRegionalFundRevenueCents: 0,
      totalInfrastructureCostCents: 0,
      totalIncentivesCents: 0,
      currency: 'BRL',
      createdAt: new Date().toISOString(),
    };

    this.revenueSnapshots.set(snapshotId, snapshot);

    marketplaceLogger.init('Snapshot de receita mensal gerado', {
      snapshotId,
      region: `${region.city}, ${region.state}`,
      period: `${period.month}/${period.year}`,
    });

    return snapshot;
  }

  getRevenueSnapshot(region: { country: string; state: string; city: string }, period: {
    year: number;
    month: number;
  }): RevenueSnapshot | null {
    return (
      Array.from(this.revenueSnapshots.values()).find(
        s =>
          s.region.country === region.country &&
          s.region.state === region.state &&
          s.region.city === region.city &&
          s.period.year === period.year &&
          s.period.month === period.month
      ) || null
    );
  }

  async getRegionalFinancialFlow(tenantId: string, region: { country: string; state: string; city: string }, period: {
    year: number;
    month: number;
  }): Promise<RegionalFinancialFlow> {
    const snapshot = this.getRevenueSnapshot(region, period);
    if (!snapshot) {
      throw new Error('Snapshot de receita não encontrado para o período especificado');
    }

    const regionalFund = await regionalFundService.getRegionalFundByRegion(tenantId, region);

    const flow: RegionalFinancialFlow = {
      region,
      period,
      totalTransactedCents: snapshot.totalTransactedCents,
      totalFeesCents: snapshot.totalFeesCents,
      regionalFund: {
        totalRevenueCents: snapshot.totalRegionalFundRevenueCents,
        infrastructureCostCents: snapshot.totalInfrastructureCostCents,
        netBalanceCents: snapshot.totalRegionalFundRevenueCents - snapshot.totalInfrastructureCostCents,
      },
      platform: {
        totalRevenueCents: snapshot.totalPlatformRevenueCents,
      },
      infrastructure: {
        totalCostCents: snapshot.totalInfrastructureCostCents,
        fundedByRegionalFundCents: snapshot.totalInfrastructureCostCents,
      },
      incentives: {
        totalGrantedCents: snapshot.totalIncentivesCents,
      },
      currency: snapshot.currency,
      generatedAt: new Date().toISOString(),
    };

    return flow;
  }
}