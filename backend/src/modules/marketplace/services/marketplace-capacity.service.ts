// backend/src/modules/marketplace/services/marketplace-capacity.service.ts
// Agregador: recursos, capacidade, compensações, capacidade regional, expansão, perfil de custo.
// Estado vive nos domain services (expansion, compensation, etc.); este agregador apenas delega.

import type {
  ServiceResource,
  ServiceResourceType,
  ServiceResourceStatus,
  ServiceResourceDependency,
  CompanyCapacityMetrics,
  ResourceCapacityMetrics,
  CapacityEvent,
  ResourceCompensationConfig,
  ResourceCompensation,
  ResourceCompensationHistory,
  CompanyCompensationReport,
  RegionalCapacitySnapshot,
  RegionalCapacityMetric,
  RegionalCapacityStatus,
  RegionalExpansionSignal,
  ExpansionSignalType,
  ExpansionUnlockFeature,
  ExpansionUnlock,
  OperationalCostProfile,
} from '@contracts/marketplace';
import type { CapacityApplicationService } from '../application/services/capacity-application.service';
import type { RegionalCapacityApplicationService } from '../application/services/regional-capacity-application.service';
import type { DomainEvent } from '../core/event-bus';
import type { ServiceCompletedPayload } from '../core/events';

/** Domain de compensação: o agregador delega a ele para manter domain = SSOT. */
export interface ICompensationDomain {
  processResourceCompensation(
    tenantId: string,
    serviceOrderId: string,
    serviceBookingId: string,
    completedResources: string[]
  ): Promise<ResourceCompensation[]>;
  markCompensationAsPaid(compensationId: string): ResourceCompensation | null;
  getResourceCompensations(resourceId: string, options?: { starts_at?: string; ends_at?: string; status?: ResourceCompensation['status'] }): ResourceCompensation[];
  getCompanyCompensations(storeId: string, options?: { starts_at?: string; ends_at?: string; status?: ResourceCompensation['status'] }): ResourceCompensation[];
  generateResourceCompensationHistory(resourceId: string, startDate: string, endDate: string): ResourceCompensationHistory;
  generateCompanyCompensationReport(storeId: string, startDate: string, endDate: string): CompanyCompensationReport;
}

export class MarketplaceCapacityAggregatorService {
  constructor(
    private readonly capacity: CapacityApplicationService,
    private readonly regionalCapacity: RegionalCapacityApplicationService,
    private readonly compensationDomain: ICompensationDomain
  ) {}

  createOrUpdateServiceResource(
    storeId: string,
    type: ServiceResourceType,
    name: string,
    options: Parameters<CapacityApplicationService['createOrUpdateServiceResource']>[3]
  ): ServiceResource {
    return this.capacity.createOrUpdateServiceResource(storeId, type, name, options);
  }

  getServiceResource(resourceId: string): ServiceResource | null {
    return this.capacity.getServiceResource(resourceId);
  }

  getServiceResourcesByStore(storeId: string): ServiceResource[] {
    return this.capacity.getServiceResourcesByStore(storeId);
  }

  updateServiceResourceStatus(
    resourceId: string,
    status: ServiceResourceStatus,
    reason?: string
  ): ServiceResource | null {
    return this.capacity.updateServiceResourceStatus(resourceId, status, reason);
  }

  createResourceDependency(
    serviceTemplateId: string,
    requiredResourceIds: string[],
    allRequired?: boolean
  ): ServiceResourceDependency {
    return this.capacity.createResourceDependency(serviceTemplateId, requiredResourceIds, allRequired ?? true);
  }

  getResourceDependenciesByService(serviceTemplateId: string): ServiceResourceDependency[] {
    return this.capacity.getResourceDependenciesByService(serviceTemplateId);
  }

  recalculateResourceCapacity(resourceId: string): void {
    this.capacity.recalculateResourceCapacity(resourceId);
  }

  recalculateCompanyCapacity(storeId: string): void {
    this.capacity.recalculateCompanyCapacity(storeId);
  }

  getCompanyCapacityMetrics(storeId: string): CompanyCapacityMetrics | null {
    return this.capacity.getCompanyCapacityMetrics(storeId);
  }

  getResourceCapacityMetrics(resourceId: string): ResourceCapacityMetrics | null {
    return this.capacity.getResourceCapacityMetrics(resourceId);
  }

  checkResourceAvailability(
    serviceTemplateId: string,
    storeId: string,
    date: string,
    time: string
  ): { available: boolean; missing_resources: string[]; available_resources: string[] } {
    return this.capacity.checkResourceAvailability(serviceTemplateId, storeId, date, time);
  }

  getEligibleResourcesForMatching(storeId: string, serviceTemplateId: string): ServiceResource[] {
    return this.capacity.getEligibleResourcesForMatching(storeId, serviceTemplateId);
  }

  getCapacityEventsMap(): Map<string, CapacityEvent> {
    return this.capacity.getCapacityEventsMap();
  }

  setResourceCompensationConfig(
    resourceId: string,
    config: Omit<ResourceCompensationConfig, 'resourceId' | 'createdAt' | 'updatedAt' | 'immutable'>
  ): ResourceCompensationConfig {
    return this.capacity.setResourceCompensationConfig(resourceId, config);
  }

  getResourceCompensationConfig(resourceId: string): ResourceCompensationConfig | null {
    return this.capacity.getResourceCompensationConfig(resourceId);
  }

  calculateResourceCompensation(
    resourceId: string,
    serviceOrderId: string,
    serviceBookingId: string,
    serviceValue: { amountCents: number; currency: string }
  ): ResourceCompensation {
    return this.capacity.calculateResourceCompensation(
      resourceId,
      serviceOrderId,
      serviceBookingId,
      serviceValue
    );
  }

  async recordResourceCompensationLedger(
    tenantId: string,
    compensation: ResourceCompensation,
    storeId: string,
    resourceId: string
  ): Promise<string> {
    return this.capacity.recordResourceCompensationLedger(tenantId, compensation, storeId, resourceId);
  }

  async processResourceCompensation(
    tenantId: string,
    serviceOrderId: string,
    serviceBookingId: string,
    completedResources: string[]
  ): Promise<ResourceCompensation[]> {
    return this.compensationDomain.processResourceCompensation(
      tenantId,
      serviceOrderId,
      serviceBookingId,
      completedResources
    );
  }

  markCompensationAsPaid(compensationId: string): ResourceCompensation | null {
    return this.compensationDomain.markCompensationAsPaid(compensationId);
  }

  getResourceCompensations(
    resourceId: string,
    options?: { starts_at?: string; ends_at?: string; status?: ResourceCompensation['status'] }
  ): ResourceCompensation[] {
    return this.compensationDomain.getResourceCompensations(resourceId, options);
  }

  getCompanyCompensations(
    storeId: string,
    options?: { starts_at?: string; ends_at?: string; status?: ResourceCompensation['status'] }
  ): ResourceCompensation[] {
    return this.compensationDomain.getCompanyCompensations(storeId, options);
  }

  generateResourceCompensationHistory(
    resourceId: string,
    startDate: string,
    endDate: string
  ): ResourceCompensationHistory {
    return this.compensationDomain.generateResourceCompensationHistory(resourceId, startDate, endDate);
  }

  generateCompanyCompensationReport(storeId: string, startDate: string, endDate: string): CompanyCompensationReport {
    return this.compensationDomain.generateCompanyCompensationReport(storeId, startDate, endDate);
  }

  calculateRegionalCapacityMetric(
    regionId: string,
    serviceCategory: string,
    period?: { start: string; end: string }
  ): RegionalCapacityMetric {
    return this.regionalCapacity.calculateRegionalCapacityMetric(regionId, serviceCategory, period);
  }

  generateRegionalCapacitySnapshot(
    regionId: string,
    period: { start: string; end: string },
    periodType?: 'weekly' | 'monthly'
  ): RegionalCapacitySnapshot {
    return this.regionalCapacity.generateRegionalCapacitySnapshot(regionId, period, periodType ?? 'monthly');
  }

  getRegionalCapacitySnapshot(snapshotId: string): RegionalCapacitySnapshot | null {
    return this.regionalCapacity.getRegionalCapacitySnapshot(snapshotId);
  }

  listRegionalCapacitySnapshots(filters?: {
    regionId?: string;
    periodType?: 'weekly' | 'monthly';
    starts_at?: string;
    ends_at?: string;
  }): RegionalCapacitySnapshot[] {
    return this.regionalCapacity.listRegionalCapacitySnapshots(filters);
  }

  getRegionalCapacityMetric(regionId: string, serviceCategory: string): RegionalCapacityMetric | null {
    return this.regionalCapacity.getRegionalCapacityMetric(regionId, serviceCategory);
  }

  listRegionalCapacityMetrics(filters?: {
    regionId?: string;
    serviceCategory?: string;
    status?: RegionalCapacityStatus;
  }): RegionalCapacityMetric[] {
    return this.regionalCapacity.listRegionalCapacityMetrics(filters);
  }

  generateExpansionSignalsFromSnapshot(snapshotId: string): RegionalExpansionSignal[] {
    return this.regionalCapacity.generateExpansionSignalsFromSnapshot(snapshotId);
  }

  getActiveExpansionSignals(filters?: {
    regionId?: string;
    serviceCategory?: string;
    signalType?: ExpansionSignalType;
  }): RegionalExpansionSignal[] {
    return this.regionalCapacity.getActiveExpansionSignals(filters);
  }

  getAvailableExpansionUnlocks(filters?: {
    regionId?: string;
    serviceCategory?: string;
    feature?: ExpansionUnlockFeature;
  }): ExpansionUnlock[] {
    return this.regionalCapacity.getAvailableExpansionUnlocks(filters);
  }

  consumeExpansionUnlock(unlockId: string): ExpansionUnlock | null {
    return this.regionalCapacity.consumeExpansionUnlock(unlockId);
  }

  isFeatureUnlocked(
    regionId: string,
    serviceCategory: string,
    feature: ExpansionUnlockFeature
  ): boolean {
    return this.regionalCapacity.isFeatureUnlocked(regionId, serviceCategory, feature);
  }

  resolveExpansionSignal(signalId: string): RegionalExpansionSignal | null {
    return this.regionalCapacity.resolveExpansionSignal(signalId);
  }

  hasExpansionSignals(regionId: string): boolean {
    return this.regionalCapacity.hasExpansionSignals(regionId);
  }

  getRegionalExpansionSummary(regionId: string): {
    active_signals_count: number;
    available_unlocks_count: number;
    categories_affected: string[];
    features_unlocked: ExpansionUnlockFeature[];
  } {
    return this.regionalCapacity.getRegionalExpansionSummary(regionId);
  }

  setOperationalCostProfile(
    storeId: string,
    companyId: string,
    profile: Parameters<RegionalCapacityApplicationService['setOperationalCostProfile']>[2]
  ): OperationalCostProfile {
    return this.regionalCapacity.setOperationalCostProfile(storeId, companyId, profile);
  }

  getOperationalCostProfile(storeId: string): OperationalCostProfile | null {
    return this.regionalCapacity.getOperationalCostProfile(storeId);
  }

  /** React to ServiceCompletedEvent: can be extended to record capacity metrics when domain is injectable. */
  handleServiceCompleted(_event: DomainEvent<ServiceCompletedPayload>): void {
    // No-op for now; extend when capacity domain recordCapacityEvent is available on aggregator
  }
}