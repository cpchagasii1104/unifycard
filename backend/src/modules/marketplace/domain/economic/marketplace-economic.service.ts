// backend/src/modules/marketplace/marketplace.service.economic.ts
// Módulo Economic Sustainability — snapshots e perfis de custo legado (Fase 2A: estado)

import type { MarketplaceService } from '../../marketplace.service';
import type { EconomicSustainabilitySnapshot } from '@contracts/marketplace';
import { marketplaceLogger } from '../../marketplace.logger';

/** Perfil de custo operacional (actor + period). Tipo local, ex-sub-services/legacy. */
type OperationalCostProfile = {
  profile_id: string;
  actorId: string;
  actorType: 'store' | 'service_provider';
  period: { year: number; month: number };
  fixed_costs: {
    rent?: number;
    utilities?: number;
    internet?: number;
    salaries?: number;
    taxes?: number;
    other?: number;
  };
  variable_costs: Array<{
    product_id?: string;
    service_id?: string;
    cost_per_unit: number;
    currency: string;
  }>;
  declared_volume_expectation?: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export class MarketplaceEconomicModule {
  constructor(private readonly facade: MarketplaceService) {}

  private readonly legacyOperationalCostProfiles: Map<string, OperationalCostProfile> = new Map();
  private readonly economicSustainabilitySnapshots: Map<string, EconomicSustainabilitySnapshot> = new Map();

  setEconomicSustainabilitySnapshot(snapshotId: string, snapshot: EconomicSustainabilitySnapshot): void {
    this.economicSustainabilitySnapshots.set(snapshotId, snapshot);
  }

  getEconomicSustainabilitySnapshots(actorId: string): EconomicSustainabilitySnapshot[] {
    return Array.from(this.economicSustainabilitySnapshots.values())
      .filter(s => s.actorId === actorId)
      .sort((a, b) => {
        if (a.period.year !== b.period.year) return b.period.year - a.period.year;
        return b.period.month - a.period.month;
      });
  }

  getLatestEconomicSustainabilitySnapshot(actorId: string): EconomicSustainabilitySnapshot | null {
    const snapshots = this.getEconomicSustainabilitySnapshots(actorId);
    return snapshots.length > 0 ? snapshots[0] : null;
  }

  createLegacyOperationalCostProfile(input: {
    actorId: string;
    actorType: 'store' | 'service_provider';
    period: { year: number; month: number };
    fixed_costs: {
      rent?: number;
      utilities?: number;
      internet?: number;
      salaries?: number;
      taxes?: number;
      other?: number;
    };
    variable_costs: Array<{
      product_id?: string;
      service_id?: string;
      cost_per_unit: number;
      currency: string;
    }>;
    declared_volume_expectation?: number;
  }): OperationalCostProfile {
    const profileId = `cost-profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const profile: OperationalCostProfile = {
      profile_id: profileId,
      actorId: input.actorId,
      actorType: input.actorType,
      period: input.period,
      fixed_costs: input.fixed_costs,
      variable_costs: input.variable_costs,
      declared_volume_expectation: input.declared_volume_expectation,
      currency: input.variable_costs[0]?.currency || 'BRL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.legacyOperationalCostProfiles.set(profileId, profile);

    marketplaceLogger.init('Perfil de custo operacional criado', {
      profile_id: profileId,
      actorId: input.actorId,
      period: `${input.period.month}/${input.period.year}`,
    });

    return profile;
  }

  getLegacyOperationalCostProfile(actorId: string, period: { year: number; month: number }): OperationalCostProfile | null {
    for (const profile of this.legacyOperationalCostProfiles.values()) {
      if (
        profile.actorId === actorId &&
        profile.period.year === period.year &&
        profile.period.month === period.month
      ) {
        return profile;
      }
    }
    return null;
  }

  updateLegacyOperationalCostProfile(profileId: string, input: {
    fixed_costs?: {
      rent?: number;
      utilities?: number;
      internet?: number;
      salaries?: number;
      taxes?: number;
      other?: number;
    };
    variable_costs?: Array<{
      product_id?: string;
      service_id?: string;
      cost_per_unit: number;
      currency: string;
    }>;
    declared_volume_expectation?: number;
  }): OperationalCostProfile {
    const profile = this.legacyOperationalCostProfiles.get(profileId);
    if (!profile) {
      throw new Error(`Perfil de custo operacional não encontrado: ${profileId}`);
    }

    const updated: OperationalCostProfile = {
      ...profile,
      ...(input.fixed_costs != null && { fixed_costs: input.fixed_costs }),
      ...(input.variable_costs != null && { variable_costs: input.variable_costs }),
      ...(input.declared_volume_expectation !== undefined && { declared_volume_expectation: input.declared_volume_expectation }),
      updatedAt: new Date().toISOString(),
    };

    this.legacyOperationalCostProfiles.set(profileId, updated);
    return updated;
  }
}