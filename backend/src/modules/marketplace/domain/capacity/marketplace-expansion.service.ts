// backend/src/modules/marketplace/domain/capacity/marketplace-expansion.service.ts
// Single source of truth: snapshots de capacidade regional, métricas, sinais de expansão, unlocks.
// Estado (Maps) vive apenas aqui; facade e agregadores apenas delegam.

import type { MarketplaceService } from "../../marketplace.service";
import type {
  RegionalCapacitySnapshot,
  RegionalCapacityMetric,
  RegionalExpansionSignal,
  ExpansionUnlock,
} from "@contracts/marketplace";

export class MarketplaceExpansionService {

  private regionalCapacitySnapshots = new Map<string, RegionalCapacitySnapshot>();
  private regionalCapacityMetrics = new Map<string, RegionalCapacityMetric>();
  private regionalExpansionSignals = new Map<string, RegionalExpansionSignal>();
  private expansionUnlocks = new Map<string, ExpansionUnlock>();

  constructor(private readonly facade: MarketplaceService) {}

  // Snapshots
  getRegionalCapacitySnapshot(id: string): RegionalCapacitySnapshot | null {
    return this.regionalCapacitySnapshots.get(id) ?? null;
  }

  setRegionalCapacitySnapshot(id: string, snapshot: RegionalCapacitySnapshot): void {
    this.regionalCapacitySnapshots.set(id, snapshot);
  }

  getRegionalCapacitySnapshotsMap(): Map<string, RegionalCapacitySnapshot> {
    return this.regionalCapacitySnapshots;
  }

  // Metrics
  getRegionalCapacityMetric(id: string): RegionalCapacityMetric | null {
    return this.regionalCapacityMetrics.get(id) ?? null;
  }

  setRegionalCapacityMetric(id: string, metric: RegionalCapacityMetric): void {
    this.regionalCapacityMetrics.set(id, metric);
  }

  getRegionalCapacityMetricsMap(): Map<string, RegionalCapacityMetric> {
    return this.regionalCapacityMetrics;
  }

  // Expansion signals
  getRegionalExpansionSignal(id: string): RegionalExpansionSignal | null {
    return this.regionalExpansionSignals.get(id) ?? null;
  }

  setRegionalExpansionSignal(id: string, signal: RegionalExpansionSignal): void {
    this.regionalExpansionSignals.set(id, signal);
  }

  getRegionalExpansionSignalsMap(): Map<string, RegionalExpansionSignal> {
    return this.regionalExpansionSignals;
  }

  // Unlocks
  getExpansionUnlock(id: string): ExpansionUnlock | null {
    return this.expansionUnlocks.get(id) ?? null;
  }

  setExpansionUnlock(id: string, unlock: ExpansionUnlock): void {
    this.expansionUnlocks.set(id, unlock);
  }

  getExpansionUnlocksMap(): Map<string, ExpansionUnlock> {
    return this.expansionUnlocks;
  }
}