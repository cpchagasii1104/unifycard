// backend/src/modules/marketplace/application/services/regional-capacity-application.service.ts
// Application Service: regional capacity, expansion signals, operational cost profile.

import type { MarketplaceCapacityModule } from '../../domain/capacity/marketplace-capacity.service';
import type {
  ServiceResource,
  ServiceRequest,
  ServiceDispatch,
  CapacityEvent,
  ServiceGovernanceMetrics,
  RegionalCapacitySnapshot,
  RegionalCapacityMetric,
  RegionalCapacityStatus,
  BottleneckCause,
  SLARiskLevel,
  RegionalExpansionSignal,
  ExpansionSignalType,
  ExpansionUnlockFeature,
  ExpansionUnlock,
  OperationalCostProfile,
} from '@contracts/marketplace';
import { marketplaceLogger } from '../../marketplace.logger';

export interface IRegionalCapacitySnapshotStore {
  get(id: string): RegionalCapacitySnapshot | undefined;
  set(id: string, value: RegionalCapacitySnapshot): void;
  getMap(): Map<string, RegionalCapacitySnapshot>;
}

export interface IRegionalCapacityMetricsStore {
  get(id: string): RegionalCapacityMetric | undefined;
  set(id: string, value: RegionalCapacityMetric): void;
  getMap(): Map<string, RegionalCapacityMetric>;
}

export interface IRegionalExpansionSignalsStore {
  get(id: string): RegionalExpansionSignal | undefined;
  set(id: string, value: RegionalExpansionSignal): void;
  getMap(): Map<string, RegionalExpansionSignal>;
}

export interface IExpansionUnlocksStore {
  get(id: string): ExpansionUnlock | undefined;
  set(id: string, value: ExpansionUnlock): void;
  getMap(): Map<string, ExpansionUnlock>;
}

export interface IOperationalCostProfilesStore {
  get(id: string): OperationalCostProfile | undefined;
  set(id: string, value: OperationalCostProfile): void;
  getMap(): Map<string, OperationalCostProfile>;
}

export interface IRegionalCapacityOrchestrator {
  getStores(scope?: string, valueCents?: string): { stores: Array<{ storeId: string; branches: Array<{ location?: { city?: string; neighborhood?: string } }> }> };
  getServiceResourcesByStore(storeId: string): ServiceResource[];
  getCapacityEventsMap(): Map<string, CapacityEvent>;
  getServiceRequestsMap(): Map<string, ServiceRequest>;
  getServiceDispatchesMap(): Map<string, ServiceDispatch>;
  getServiceGovernanceMetricsMap(): Map<string, ServiceGovernanceMetrics>;
  getCategories(): { categories: Array<{ id: string }> };
}

export interface IRegionalCapacityApplicationDeps {
  snapshotStore: IRegionalCapacitySnapshotStore;
  metricsStore: IRegionalCapacityMetricsStore;
  expansionSignalsStore: IRegionalExpansionSignalsStore;
  expansionUnlocksStore: IExpansionUnlocksStore;
  operationalCostProfilesStore: IOperationalCostProfilesStore;
  orchestrator: IRegionalCapacityOrchestrator;
}

export class RegionalCapacityApplicationService {
  constructor(
    private readonly capacityModule: MarketplaceCapacityModule,
    private readonly deps: IRegionalCapacityApplicationDeps
  ) {}

  private calculateSLARiskLevel(
    avgResponseTime: number,
    avgExecutionTime: number,
    slaViolationRate: number,
    requestExpirationRate: number
  ): SLARiskLevel {
    if (slaViolationRate > 0.3 || requestExpirationRate > 0.5) return 'high';
    if (avgResponseTime > 60 || avgExecutionTime > 120) return 'high';
    if (slaViolationRate > 0.15 || requestExpirationRate > 0.3) return 'medium';
    if (avgResponseTime > 30 || avgExecutionTime > 90) return 'medium';
    return 'low';
  }

  private classifyRegionalCapacity(
    avgUtilizationRate: number,
    requestExpirationRate: number,
    dispatchRejectionRate: number,
    avgConfirmationTime: number,
    requestToExecutionRate: number,
    overloadedResources: number,
    totalResources: number
  ): {
    status: RegionalCapacityStatus;
    bottleneckCause?: BottleneckCause;
    bottleneckDetails?: string;
  } {
    if (totalResources > 0 && overloadedResources / totalResources > 0.3 && requestExpirationRate > 0.4) {
      return {
        status: 'critical',
        bottleneckCause: 'lack_of_professionals',
        bottleneckDetails: `Alta taxa de recursos sobrecarregados (${Math.round((overloadedResources / totalResources) * 100)}%) e alta taxa de expiração de requests (${Math.round(requestExpirationRate * 100)}%)`,
      };
    }
    if (requestToExecutionRate < 0.3 && dispatchRejectionRate > 0.5) {
      return {
        status: 'critical',
        bottleneckCause: 'excess_demand',
        bottleneckDetails: `Baixa taxa de conversão (${Math.round(requestToExecutionRate * 100)}%) e alta rejeição de dispatches (${Math.round(dispatchRejectionRate * 100)}%)`,
      };
    }
    if (avgUtilizationRate > 0.8 && avgConfirmationTime > 60) {
      return {
        status: 'warning',
        bottleneckCause: 'schedule_bottleneck',
        bottleneckDetails: `Alta utilização (${Math.round(avgUtilizationRate * 100)}%) e tempo médio de confirmação alto (${Math.round(avgConfirmationTime)} minutos)`,
      };
    }
    if (requestExpirationRate > 0.3) {
      return {
        status: 'warning',
        bottleneckCause: 'lack_of_professionals',
        bottleneckDetails: `Alta taxa de expiração de requests (${Math.round(requestExpirationRate * 100)}%)`,
      };
    }
    if (totalResources > 0 && overloadedResources / totalResources > 0.2) {
      return {
        status: 'warning',
        bottleneckCause: 'capacity_distribution_issue',
        bottleneckDetails: `Proporção significativa de recursos sobrecarregados (${Math.round((overloadedResources / totalResources) * 100)}%)`,
      };
    }
    return { status: 'healthy' };
  }

  calculateRegionalCapacityMetric(
    regionId: string,
    serviceCategory: string,
    period?: { start: string; end: string }
  ): RegionalCapacityMetric {
    const now = new Date();
    const periodStart = period?.start ? new Date(period.start) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const periodEnd = period?.end ? new Date(period.end) : now;

    const stores = this.deps.orchestrator.getStores();
    const regionStores = stores.stores.filter((store: { storeId: string; branches: Array<{ location?: { city?: string; neighborhood?: string } }> }) => {
      if (regionId.includes('-')) {
        const [city, neighborhood] = regionId.split('-');
        return store.branches.some((b: { location?: { city?: string; neighborhood?: string } }) => b.location?.city === city && b.location?.neighborhood === neighborhood);
      }
      return store.branches.some((b: { location?: { city?: string } }) => b.location?.city === regionId);
    });

    const allResources: ServiceResource[] = [];
    for (const store of regionStores) {
      const storeResources = this.deps.orchestrator.getServiceResourcesByStore(store.storeId);
      allResources.push(...storeResources);
    }

    const totalResources = allResources.length;
    const activeResources = allResources.filter(r => r.status === 'active').length;
    const overloadedResources = allResources.filter(r => r.status === 'overloaded').length;

    let totalUtilization = 0;
    let peakUtilization = 0;
    for (const resource of allResources) {
      const capacity = resource.currentCapacity;
      if (capacity.totalSlotsAvailable > 0) {
        const utilization = (capacity.slotsReserved + capacity.slotsConfirmed + capacity.slotsInProgress) / capacity.totalSlotsAvailable;
        totalUtilization += utilization;
        peakUtilization = Math.max(peakUtilization, utilization);
      }
    }
    const avgUtilizationRate = totalResources > 0 ? totalUtilization / totalResources : 0;

    const capacityEvents = Array.from(this.deps.orchestrator.getCapacityEventsMap().values())
      .filter(e => {
        if (e.resourceId) {
          const resource = allResources.find(r => r.resourceId === e.resourceId);
          return !!resource;
        }
        return regionStores.some((s: { storeId: string }) => s.storeId === e.storeId);
      })
      .filter(e => {
        const eventDate = new Date(e.createdAt);
        return eventDate >= periodStart && eventDate <= periodEnd;
      })
      .filter(e => e.eventType === 'resource_overloaded');

    const overloadEventsCount = capacityEvents.length;

    const serviceRequests = Array.from(this.deps.orchestrator.getServiceRequestsMap().values())
      .filter((r: ServiceRequest) => {
        const requestDate = new Date(r.createdAt);
        return requestDate >= periodStart && requestDate <= periodEnd;
      });

    const totalRequests = serviceRequests.length;
    const expiredRequests = serviceRequests.filter((r: ServiceRequest) => {
      const expiredAt = r.expiredAt ? new Date(r.expiredAt) : null;
      return expiredAt && expiredAt < now;
    }).length;
    const requestExpirationRate = totalRequests > 0 ? expiredRequests / totalRequests : 0;

    const dispatches = Array.from(this.deps.orchestrator.getServiceDispatchesMap().values())
      .filter((d: ServiceDispatch) => {
        const request = serviceRequests.find((r: ServiceRequest) => r.requestId === d.requestId);
        return !!request;
      });

    const totalDispatches = dispatches.length;
    const rejectedDispatches = dispatches.filter((d: ServiceDispatch) => d.status === 'declined' || d.status === 'expired').length;
    const dispatchRejectionRate = totalDispatches > 0 ? rejectedDispatches / totalDispatches : 0;

    let totalResponseTime = 0;
    let responseTimeCount = 0;
    let totalExecutionTime = 0;
    let executionTimeCount = 0;
    let totalConfirmationTime = 0;
    let confirmationTimeCount = 0;

    for (const dispatch of dispatches as ServiceDispatch[]) {
      if (dispatch.createdAt && dispatch.acceptedAt) {
        const responseTime = (new Date(dispatch.acceptedAt).getTime() - new Date(dispatch.createdAt).getTime()) / (1000 * 60);
        totalResponseTime += responseTime;
        responseTimeCount++;
      }
      const request = serviceRequests.find((r: ServiceRequest) => r.requestId === dispatch.requestId);
      if (request && request.acceptedAt) {
        const executionTime = (new Date(request.acceptedAt).getTime() - new Date(request.createdAt).getTime()) / (1000 * 60);
        totalExecutionTime += executionTime;
        executionTimeCount++;
      }
      if (dispatch.acceptedAt && dispatch.createdAt) {
        const confirmationTime = (new Date(dispatch.acceptedAt).getTime() - new Date(dispatch.createdAt).getTime()) / (1000 * 60);
        totalConfirmationTime += confirmationTime;
        confirmationTimeCount++;
      }
    }

    const avgResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;
    const avgExecutionTime = executionTimeCount > 0 ? totalExecutionTime / executionTimeCount : 0;
    const avgConfirmationTime = confirmationTimeCount > 0 ? totalConfirmationTime / confirmationTimeCount : 0;

    const executedRequests = serviceRequests.filter((r: ServiceRequest) => (r as { status: string }).status === 'completed').length;
    const requestToExecutionRate = totalRequests > 0 ? executedRequests / totalRequests : 0;

    const slaMetrics = Array.from(this.deps.orchestrator.getServiceGovernanceMetricsMap().values())
      .filter((m: ServiceGovernanceMetrics) => {
        const resource = allResources.find(r => r.actorId === m.providerActorId);
        return !!resource;
      });

    const totalSLA = slaMetrics.length;
    const violatedSLA = slaMetrics.filter((m: ServiceGovernanceMetrics) => m.status === 'sla_violation').length;
    const slaViolationRate = totalSLA > 0 ? violatedSLA / totalSLA : 0;

    const slaRiskLevel: SLARiskLevel = this.calculateSLARiskLevel(
      avgResponseTime,
      avgExecutionTime,
      slaViolationRate,
      requestExpirationRate
    );

    const { status, bottleneckCause, bottleneckDetails } = this.classifyRegionalCapacity(
      avgUtilizationRate,
      requestExpirationRate,
      dispatchRejectionRate,
      avgConfirmationTime,
      requestToExecutionRate,
      overloadedResources,
      totalResources
    );

    const metric: RegionalCapacityMetric = {
      regionId,
      serviceCategory,
      totalResources,
      activeResources,
      overloadedResources,
      avgUtilizationRate,
      peakUtilizationRate: peakUtilization,
      overloadEventsCount,
      requestExpirationRate,
      dispatchRejectionRate,
      avgResponseTimeMinutes: avgResponseTime,
      avgExecutionTimeMinutes: avgExecutionTime,
      avgConfirmationTimeMinutes: avgConfirmationTime,
      slaRiskLevel,
      slaViolationRate,
      requestToExecutionRate,
      status,
      bottleneckCause,
      bottleneckDetails,
      calculatedAt: new Date().toISOString(),
      immutable: true,
    };

    const metricKey = `${regionId}-${serviceCategory}`;
    this.deps.metricsStore.set(metricKey, metric);
    return metric;
  }

  generateRegionalCapacitySnapshot(
    regionId: string,
    period: { start: string; end: string },
    periodType: 'weekly' | 'monthly' = 'monthly'
  ): RegionalCapacitySnapshot {
    const snapshots = this.deps.snapshotStore.getMap();
    const existingSnapshot = Array.from(snapshots.values())
      .find(s => s.regionId === regionId && s.period.start === period.start && s.period.end === period.end);

    if (existingSnapshot) {
      throw new Error('Snapshot já existe para este período (imutável)');
    }

    const categories = this.deps.orchestrator.getCategories();
    const categoryIds = categories.categories.map(c => c.id);

    const byCategory: RegionalCapacityMetric[] = [];
    for (const categoryId of categoryIds) {
      const metric = this.calculateRegionalCapacityMetric(regionId, categoryId, period);
      byCategory.push(metric);
    }

    const totalResources = byCategory.reduce((sum, m) => sum + m.totalResources, 0);
    const totalActiveResources = byCategory.reduce((sum, m) => sum + m.activeResources, 0);
    const totalOverloadedResources = byCategory.reduce((sum, m) => sum + m.overloadedResources, 0);

    const identifiedBottlenecks = byCategory
      .filter(m => m.status !== 'healthy' && m.bottleneckCause)
      .map(m => ({
        category: m.serviceCategory,
        cause: m.bottleneckCause!,
        severity: (m.status === 'critical' ? 'high' : m.status === 'warning' ? 'medium' : 'low') as 'high' | 'medium' | 'low',
        details: m.bottleneckDetails || '',
      }));

    const criticalCount = byCategory.filter(m => m.status === 'critical').length;
    const warningCount = byCategory.filter(m => m.status === 'warning').length;
    const overallStatus: RegionalCapacityStatus = criticalCount > 0 ? 'critical' : warningCount > byCategory.length * 0.3 ? 'warning' : 'healthy';

    const highRiskCount = byCategory.filter(m => m.slaRiskLevel === 'high').length;
    const mediumRiskCount = byCategory.filter(m => m.slaRiskLevel === 'medium').length;
    const overallSLARisk: SLARiskLevel = highRiskCount > 0 ? 'high' : mediumRiskCount > byCategory.length * 0.3 ? 'medium' : 'low';

    const byCompanyType: Array<{
      companyType: string;
      totalResources: number;
      activeResources: number;
      avgUtilizationRate: number;
      status: RegionalCapacityStatus;
    }> = [];

    const snapshotId = `snapshot-${regionId}-${period.start}-${period.end}`;
    const snapshot: RegionalCapacitySnapshot = {
      snapshotId,
      regionId,
      period,
      periodType,
      totalResources,
      totalActiveResources,
      totalOverloadedResources,
      byCategory,
      byCompanyType,
      identifiedBottlenecks,
      overallStatus,
      overallSlaRisk: overallSLARisk,
      version: 'v1.0',
      generatedAt: new Date().toISOString(),
      immutable: true,
    };

    this.deps.snapshotStore.set(snapshotId, snapshot);

    marketplaceLogger.init('Snapshot de capacidade regional gerado', {
      snapshotId,
      regionId,
      periodType,
      overallStatus,
    });

    return snapshot;
  }

  getRegionalCapacitySnapshot(snapshotId: string): RegionalCapacitySnapshot | null {
    return this.deps.snapshotStore.get(snapshotId) || null;
  }

  listRegionalCapacitySnapshots(filters?: {
    regionId?: string;
    periodType?: 'weekly' | 'monthly';
    starts_at?: string;
    ends_at?: string;
  }): RegionalCapacitySnapshot[] {
    let snapshots = Array.from(this.deps.snapshotStore.getMap().values());

    if (filters?.regionId) snapshots = snapshots.filter(s => s.regionId === filters.regionId);
    if (filters?.periodType) snapshots = snapshots.filter(s => s.periodType === filters.periodType);
    if (filters?.starts_at) snapshots = snapshots.filter(s => s.period.start >= filters.starts_at!);
    if (filters?.ends_at) snapshots = snapshots.filter(s => s.period.end <= filters.ends_at!);

    return snapshots.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }

  getRegionalCapacityMetric(regionId: string, serviceCategory: string): RegionalCapacityMetric | null {
    const metricKey = `${regionId}-${serviceCategory}`;
    return this.deps.metricsStore.get(metricKey) || null;
  }

  listRegionalCapacityMetrics(filters?: {
    regionId?: string;
    serviceCategory?: string;
    status?: RegionalCapacityStatus;
  }): RegionalCapacityMetric[] {
    let metrics = Array.from(this.deps.metricsStore.getMap().values());

    if (filters?.regionId) metrics = metrics.filter(m => m.regionId === filters.regionId);
    if (filters?.serviceCategory) metrics = metrics.filter(m => m.serviceCategory === filters.serviceCategory);
    if (filters?.status) metrics = metrics.filter(m => m.status === filters.status);

    return metrics.sort((a, b) => b.calculatedAt.localeCompare(a.calculatedAt));
  }

  private getEligibilityCriteria(feature: ExpansionUnlockFeature): string[] {
    switch (feature) {
      case 'facilitated_onboarding':
        return ['Empresa na região afetada', 'Categoria de serviço compatível', 'Trust level >= L2'];
      case 'economic_incentive':
        return ['Novo prestador na região', 'Categoria de serviço compatível', 'Trust level >= L2'];
      case 'service_catalog_suggestion':
        return ['Empresa ativa na região', 'Categoria de serviço compatível'];
      case 'b2b_capacity_market':
        return ['Empresa com capacidade disponível', 'Região compatível'];
      case 'strategic_vouchers':
        return ['Empresa na região afetada', 'Categoria de serviço compatível'];
      default:
        return [];
    }
  }

  private getAvailabilityDeadline(_feature: ExpansionUnlockFeature): string {
    const now = new Date();
    const deadline = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    return deadline.toISOString();
  }

  private createExpansionUnlock(
    signalId: string,
    feature: ExpansionUnlockFeature,
    regionId: string,
    serviceCategory: string
  ): ExpansionUnlock {
    const unlockId = `unlock-${signalId}-${feature}-${Date.now()}`;

    const featureDescriptions: Record<ExpansionUnlockFeature, string> = {
      facilitated_onboarding: 'Onboarding facilitado para esta categoria de serviço',
      economic_incentive: 'Incentivo econômico disponível para novos prestadores',
      service_catalog_suggestion: 'Sugestão de ativação de novos serviços no catálogo',
      b2b_capacity_market: 'Mercado de capacidade B2B habilitado para esta região',
      strategic_vouchers: 'Vouchers estratégicos liberados para atrair prestadores',
    };

    const unlock: ExpansionUnlock = {
      unlockId,
      signalId,
      regionId,
      serviceCategory,
      feature,
      details: {
        description: featureDescriptions[feature],
        eligibilityCriteria: this.getEligibilityCriteria(feature),
        availableUntil: this.getAvailabilityDeadline(feature),
      },
      status: 'available',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      immutable: false,
    };

    this.deps.expansionUnlocksStore.set(unlockId, unlock);
    return unlock;
  }

  generateExpansionSignalsFromSnapshot(snapshotId: string): RegionalExpansionSignal[] {
    const snapshot = this.deps.snapshotStore.get(snapshotId);
    if (!snapshot) {
      throw new Error('Snapshot não encontrado');
    }

    const signals: RegionalExpansionSignal[] = [];
    const criticalCategories = snapshot.byCategory.filter(m => m.status === 'warning' || m.status === 'critical');
    const highRiskCategories = criticalCategories.filter(m => m.slaRiskLevel === 'medium' || m.slaRiskLevel === 'high');

    for (const metric of highRiskCategories) {
      let signalType: ExpansionSignalType;
      let unlockedFeatures: ExpansionUnlockFeature[] = [];

      switch (metric.bottleneckCause) {
        case 'lack_of_professionals':
          signalType = 'need_more_providers';
          unlockedFeatures = ['facilitated_onboarding', 'economic_incentive', 'strategic_vouchers'];
          break;
        case 'excess_demand':
          signalType = 'need_more_capacity';
          unlockedFeatures = ['b2b_capacity_market', 'economic_incentive', 'strategic_vouchers'];
          break;
        case 'capacity_distribution_issue':
          signalType = 'need_more_capacity';
          unlockedFeatures = ['b2b_capacity_market', 'service_catalog_suggestion'];
          break;
        case 'schedule_bottleneck':
          signalType = 'need_extended_hours';
          unlockedFeatures = ['facilitated_onboarding', 'economic_incentive'];
          break;
        case 'time_bottleneck':
          signalType = 'need_extended_hours';
          unlockedFeatures = ['facilitated_onboarding', 'economic_incentive'];
          break;
        default:
          signalType = 'need_more_providers';
          unlockedFeatures = ['facilitated_onboarding', 'economic_incentive'];
      }

      const signalId = `expansion-signal-${snapshot.regionId}-${metric.serviceCategory}-${Date.now()}`;

      const signal: RegionalExpansionSignal = {
        signalId,
        regionId: snapshot.regionId,
        serviceCategory: metric.serviceCategory,
        signalType,
        bottleneckCause: metric.bottleneckCause || 'lack_of_professionals',
        triggeringMetrics: {
          status: metric.status,
          slaRiskLevel: metric.slaRiskLevel,
          requestExpirationRate: metric.requestExpirationRate,
          dispatchRejectionRate: metric.dispatchRejectionRate,
          avgUtilizationRate: metric.avgUtilizationRate,
          overloadedResourcesRatio: metric.totalResources > 0 ? metric.overloadedResources / metric.totalResources : 0,
        },
        sourceSnapshotId: snapshotId,
        unlockedFeatures,
        status: 'active',
        createdAt: new Date().toISOString(),
        immutable: true,
      };

      this.deps.expansionSignalsStore.set(signalId, signal);

      for (const feature of unlockedFeatures) {
        this.createExpansionUnlock(signalId, feature, snapshot.regionId, metric.serviceCategory);
      }

      signals.push(signal);
    }

    marketplaceLogger.init('Sinais de expansão gerados', {
      snapshotId,
      signals_count: signals.length,
    });

    return signals;
  }

  getActiveExpansionSignals(filters?: {
    regionId?: string;
    serviceCategory?: string;
    signalType?: ExpansionSignalType;
  }): RegionalExpansionSignal[] {
    let signals = Array.from(this.deps.expansionSignalsStore.getMap().values())
      .filter(s => s.status === 'active');

    if (filters?.regionId) signals = signals.filter(s => s.regionId === filters.regionId);
    if (filters?.serviceCategory) signals = signals.filter(s => s.serviceCategory === filters.serviceCategory);
    if (filters?.signalType) signals = signals.filter(s => s.signalType === filters.signalType);

    return signals.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getAvailableExpansionUnlocks(filters?: {
    regionId?: string;
    serviceCategory?: string;
    feature?: ExpansionUnlockFeature;
  }): ExpansionUnlock[] {
    const now = new Date();
    const unlocksMap = this.deps.expansionUnlocksStore.getMap();
    let unlocks = Array.from(unlocksMap.values())
      .filter(u => {
        if (u.status !== 'available') return false;
        if (u.details.availableUntil) {
          const deadline = new Date(u.details.availableUntil);
          if (now > deadline) {
            u.status = 'expired';
            u.updatedAt = new Date().toISOString();
            this.deps.expansionUnlocksStore.set(u.unlockId, u);
            return false;
          }
        }
        return true;
      });

    if (filters?.regionId) unlocks = unlocks.filter(u => u.regionId === filters.regionId);
    if (filters?.serviceCategory) unlocks = unlocks.filter(u => u.serviceCategory === filters.serviceCategory);
    if (filters?.feature) unlocks = unlocks.filter(u => u.feature === filters.feature);

    return unlocks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  consumeExpansionUnlock(unlockId: string): ExpansionUnlock | null {
    const unlock = this.deps.expansionUnlocksStore.get(unlockId);
    if (!unlock) return null;

    if (unlock.status !== 'available') {
      throw new Error('Desbloqueio não está disponível');
    }

    unlock.status = 'consumed';
    unlock.consumedAt = new Date().toISOString();
    unlock.updatedAt = new Date().toISOString();
    this.deps.expansionUnlocksStore.set(unlockId, unlock);

    marketplaceLogger.init('Desbloqueio de expansão consumido', {
      unlockId,
      feature: unlock.feature,
      regionId: unlock.regionId,
    });

    return unlock;
  }

  isFeatureUnlocked(
    regionId: string,
    serviceCategory: string,
    feature: ExpansionUnlockFeature
  ): boolean {
    const unlocks = this.getAvailableExpansionUnlocks({ regionId, serviceCategory, feature });
    return unlocks.length > 0;
  }

  resolveExpansionSignal(signalId: string): RegionalExpansionSignal | null {
    const signal = this.deps.expansionSignalsStore.get(signalId);
    if (!signal) return null;

    marketplaceLogger.init('Sinal de expansão resolvido', {
      signalId,
      regionId: signal.regionId,
    });

    return signal;
  }

  hasExpansionSignals(regionId: string): boolean {
    const signals = this.getActiveExpansionSignals({ regionId });
    return signals.length > 0;
  }

  getRegionalExpansionSummary(regionId: string): {
    active_signals_count: number;
    available_unlocks_count: number;
    categories_affected: string[];
    features_unlocked: ExpansionUnlockFeature[];
  } {
    const signals = this.getActiveExpansionSignals({ regionId });
    const unlocks = this.getAvailableExpansionUnlocks({ regionId });

    const categoriesAffected = [...new Set(signals.map(s => s.serviceCategory))];
    const featuresUnlocked = [...new Set(unlocks.map(u => u.feature))];

    return {
      active_signals_count: signals.length,
      available_unlocks_count: unlocks.length,
      categories_affected: categoriesAffected,
      features_unlocked: featuresUnlocked,
    };
  }

  setOperationalCostProfile(
    storeId: string,
    companyId: string,
    profile: {
      fixedCostsMonthly?: {
        rent?: { amountCents: number; currency: string };
        salaries?: { amountCents: number; currency: string };
        pro_labore?: { amountCents: number; currency: string };
        systems?: { amountCents: number; currency: string };
        other?: { amountCents: number; currency: string };
      };
      variableCostsPerService?: {
        materials?: { amountCents: number; currency: string };
        commission?: { amountCents: number; currency: string };
        transportation?: { amountCents: number; currency: string };
        other?: { amountCents: number; currency: string };
      };
      costs_per_hour?: {
        fixed_cost_per_hour?: { amountCents: number; currency: string };
        variable_cost_per_hour?: { amountCents: number; currency: string };
      };
    }
  ): OperationalCostProfile {
    const fixedTotal = (profile.fixedCostsMonthly?.rent?.amountCents || 0) +
      (profile.fixedCostsMonthly?.salaries?.amountCents || 0) +
      (profile.fixedCostsMonthly?.pro_labore?.amountCents || 0) +
      (profile.fixedCostsMonthly?.systems?.amountCents || 0) +
      (profile.fixedCostsMonthly?.other?.amountCents || 0);

    const variableAverage = (profile.variableCostsPerService?.materials?.amountCents || 0) +
      (profile.variableCostsPerService?.commission?.amountCents || 0) +
      (profile.variableCostsPerService?.transportation?.amountCents || 0) +
      (profile.variableCostsPerService?.other?.amountCents || 0);

    const costProfile: OperationalCostProfile = {
      storeId,
      companyId,
      fixedCostsMonthly: {
        rent: profile.fixedCostsMonthly?.rent,
        salaries: profile.fixedCostsMonthly?.salaries,
        proLabore: profile.fixedCostsMonthly?.pro_labore,
        systems: profile.fixedCostsMonthly?.systems,
        other: profile.fixedCostsMonthly?.other,
        totalCents: { amountCents: fixedTotal, currency: 'BRL' },
      },
      variableCostsPerService: {
        materials: profile.variableCostsPerService?.materials,
        commission: profile.variableCostsPerService?.commission,
        transportation: profile.variableCostsPerService?.transportation,
        other: profile.variableCostsPerService?.other,
        averagePerService: { amountCents: variableAverage, currency: 'BRL' },
      },
      costsPerHour: profile.costs_per_hour ? {
        fixedCostPerHour: profile.costs_per_hour.fixed_cost_per_hour || { amountCents: 0, currency: 'BRL' },
        variableCostPerHour: profile.costs_per_hour.variable_cost_per_hour || { amountCents: 0, currency: 'BRL' },
        totalCostPerHour: {
          amountCents: (profile.costs_per_hour.fixed_cost_per_hour?.amountCents || 0) + (profile.costs_per_hour.variable_cost_per_hour?.amountCents || 0),
          currency: 'BRL',
        },
      } : undefined,
      dataSource: {
        declared: true,
        historical: false,
        lastUpdated: new Date().toISOString(),
      },
      calculatedAt: new Date().toISOString(),
      immutable: false,
    };

    this.deps.operationalCostProfilesStore.set(storeId, costProfile);

    marketplaceLogger.init('Perfil de custo operacional atualizado', {
      storeId,
      companyId,
    });

    return costProfile;
  }

  getOperationalCostProfile(storeId: string): OperationalCostProfile | null {
    return this.deps.operationalCostProfilesStore.get(storeId) || null;
  }
}