// backend/src/modules/marketplace/marketplace-capacity.service.ts
// Módulo de capacidade produtiva: recursos, métricas, eventos

import type { MarketplaceService } from '../../marketplace.service';
import type {
  ServiceResource,
  ServiceResourceType,
  ServiceResourceStatus,
  ServiceResourceDependency,
  CompanyCapacityMetrics,
  ResourceCapacityMetrics,
  CapacityEvent,
  CapacitySnapshot,
  ResourceCompensationConfig,
} from '@contracts/marketplace';
import { marketplaceLogger } from '../../marketplace.logger';
import type { CompensationModel } from '@contracts/marketplace';

export class MarketplaceCapacityModule {
  private serviceResources: Map<string, ServiceResource> = new Map(); // resource_id -> resource
  private resourceDependencies: Map<string, ServiceResourceDependency> = new Map(); // dependency_id -> dependency
  private resourceCapacityMetrics: Map<string, ResourceCapacityMetrics> = new Map(); // resource_id -> metrics
  private companyCapacityMetrics: Map<string, CompanyCapacityMetrics> = new Map(); // store_id -> metrics
  private capacityEvents: Map<string, CapacityEvent> = new Map(); // eventId -> event
  private capacitySnapshots: Map<string, CapacitySnapshot> = new Map(); // snapshot_id -> snapshot
  private resourceCompensationConfigs: Map<string, ResourceCompensationConfig> = new Map(); // resourceId -> config

  constructor(private readonly facade: MarketplaceService) {}

  createOrUpdateServiceResource(
    storeId: string,
    type: ServiceResourceType,
    name: string,
    options: {
      description?: string;
      actorId?: string;
      physical_id?: string;
      has_own_agenda?: boolean;
      required_for_services?: string[];
      compensation_config?: {
        model: CompensationModel;
        percent_value?: number;
        fixed_amount?: number;
        monthly_salary?: number;
        base_salary?: number;
        variable_percent?: number;
        min_compensation?: number;
        max_compensation?: number;
        isActive: boolean;
        effective_from: string;
        effective_until?: string;
      };
    }
  ): ServiceResource {
    const resourceId = options.actorId
      ? `resource-${type}-${options.actorId}`
      : options.physical_id
      ? `resource-${type}-${options.physical_id}`
      : `resource-${type}-${Date.now()}`;

    const existing = this.serviceResources.get(resourceId);
    const now = new Date().toISOString();

    const resource: ServiceResource = {
      resourceId: resourceId,
      storeId: storeId,
      type,
      name,
      description: options.description,
      actorId: options.actorId,
      physicalId: options.physical_id,
      hasOwnAgenda: options.has_own_agenda ?? true,
      requiredForServices: options.required_for_services || [],
      status: existing?.status || 'active',
      statusReason: existing?.statusReason,
      statusUpdatedAt: existing?.statusUpdatedAt || now,
      historicalMetrics: existing?.historicalMetrics || {
        averageExecutionTimeMinutes: 0,
        slaResponseRate: 1.0,
        slaExecutionRate: 1.0,
        cancellationRate: 0,
        overrunRate: 0,
        totalServicesCompleted: 0,
        last30DaysServices: 0,
      },
      currentCapacity: existing?.currentCapacity || {
        totalSlotsAvailable: 0,
        slotsReserved: 0,
        slotsConfirmed: 0,
        slotsInProgress: 0,
        slotsAvailable: 0,
        riskLevel: 'low',
      },
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      immutable: false,
    };

    if (options.compensation_config) {
      this.setResourceCompensationConfig(resourceId, {
        compensationModel: options.compensation_config.model,
        percentValueBps: options.compensation_config.percent_value,
        fixedAmountCents: options.compensation_config.fixed_amount,
        currency: options.compensation_config.fixed_amount ? 'BRL' : undefined,
        monthlySalaryCents: options.compensation_config.monthly_salary,
        baseSalaryCents: options.compensation_config.base_salary,
        variablePercentBps: options.compensation_config.variable_percent,
        minCompensationCents: options.compensation_config.min_compensation,
        maxCompensationCents: options.compensation_config.max_compensation,
        isActive: options.compensation_config.isActive,
        effectiveFrom: options.compensation_config.effective_from,
        effectiveUntil: options.compensation_config.effective_until,
      });
    }

    this.serviceResources.set(resourceId, resource);
    this.recalculateResourceCapacity(resourceId);

    marketplaceLogger.init('ServiceResource criado/atualizado', {
      resourceId: resourceId,
      storeId: storeId,
      type,
    });

    return resource;
  }

  getServiceResource(resourceId: string): ServiceResource | null {
    return this.serviceResources.get(resourceId) || null;
  }

  getServiceResourcesByStore(storeId: string): ServiceResource[] {
    return Array.from(this.serviceResources.values())
      .filter(r => r.storeId === storeId);
  }

  updateServiceResourceStatus(
    resourceId: string,
    status: ServiceResourceStatus,
    reason?: string
  ): ServiceResource | null {
    const resource = this.serviceResources.get(resourceId);
    if (!resource) {
      return null;
    }

    resource.status = status;
    resource.statusReason = reason;
    resource.statusUpdatedAt = new Date().toISOString();
    resource.updatedAt = new Date().toISOString();

    this.serviceResources.set(resourceId, resource);
    this.recalculateResourceCapacity(resourceId);

    if (status === 'overloaded') {
      this.recordCapacityEvent({
        resourceId: resourceId,
        storeId: resource.storeId,
        companyId: resource.storeId,
        eventType: 'resource_overloaded',
        details: {
          capacityAvailable: resource.currentCapacity.slotsAvailable,
          capacityUtilized: resource.currentCapacity.slotsReserved + resource.currentCapacity.slotsConfirmed + resource.currentCapacity.slotsInProgress,
          saturationRate: resource.currentCapacity.slotsAvailable === 0 ? 1.0 : (resource.currentCapacity.slotsReserved + resource.currentCapacity.slotsConfirmed + resource.currentCapacity.slotsInProgress) / resource.currentCapacity.totalSlotsAvailable,
          reason: reason || 'Capacidade máxima atingida',
        },
      });
    }

    marketplaceLogger.init('Status de ServiceResource atualizado', {
      resourceId: resourceId,
      status,
      reason,
    });

    return resource;
  }

  createResourceDependency(
    serviceTemplateId: string,
    requiredResourceIds: string[],
    allRequired: boolean = true
  ): ServiceResourceDependency {
    const dependencyId = `dependency-${serviceTemplateId}-${Date.now()}`;

    const dependency: ServiceResourceDependency = {
      dependencyId: dependencyId,
      serviceTemplateId: serviceTemplateId,
      requiredResources: requiredResourceIds,
      allRequired: allRequired,
      createdAt: new Date().toISOString(),
      immutable: true,
    };

    this.resourceDependencies.set(dependencyId, dependency);

    marketplaceLogger.init('Dependência de recursos criada', {
      dependencyId: dependencyId,
      serviceTemplateId: serviceTemplateId,
      requiredResources: requiredResourceIds,
    });

    return dependency;
  }

  getResourceDependenciesByService(serviceTemplateId: string): ServiceResourceDependency[] {
    return Array.from(this.resourceDependencies.values())
      .filter(d => d.serviceTemplateId === serviceTemplateId);
  }

  recalculateResourceCapacity(resourceId: string): void {
    const resource = this.serviceResources.get(resourceId);
    if (!resource) {
      return;
    }

    const serviceOfferings = Array.from(this.facade.serviceOfferings.values())
      .filter(so => so.storeId === resource.storeId);

    let totalSlots = 0;
    const now = new Date();
    const currentDay = now.getDay();

    for (const offering of serviceOfferings) {
      const availability = this.facade.serviceAvailabilities.get(offering.offering_id) || [];

      for (const avail of availability) {
        if (avail.weekday === currentDay) {
          const startHour = parseInt(avail.starts_at.split(':')[0]);
          const endHour = parseInt(avail.ends_at.split(':')[0]);
          const durationMinutes = Number(offering.duration_minutes) || 60;
          const slotsPerHour = 60 / durationMinutes;
          const hoursAvailable = endHour - startHour;
          totalSlots += Math.floor(hoursAvailable * slotsPerHour * avail.capacity);
        }
      }
    }

    const preReservations = Array.from(this.facade.dispatch.getServicePreReservationsMap().values())
      .filter(pr => {
        const dispatch = this.facade.dispatch.getServiceDispatchesMap().get(pr.dispatchId);
        if (!dispatch) return false;

        const request = this.facade.dispatch.getServiceRequestsMap().get(dispatch.requestId);
        if (!request) return false;

        const dependencies = this.getResourceDependenciesByService(request.serviceTemplateId || '');
        return dependencies.some(d => d.requiredResources.includes(resourceId));
      })
      .filter(pr => {
        const expiresAt = new Date(pr.expiresAt);
        return expiresAt > now && !pr.confirmedAt;
      });

    const confirmedBookings = Array.from(this.facade.serviceBookings.values())
      .filter(booking => {
        const offering = this.facade.serviceOfferings.get(booking.offeringId);
        if (!offering || offering.storeId !== resource.storeId) return false;

        const dependencies = this.getResourceDependenciesByService(offering.templateId);
        return dependencies.some(d => d.requiredResources.includes(resourceId));
      })
      .filter(booking => {
        const bookingDate = new Date(booking.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        bookingDate.setHours(0, 0, 0, 0);
        return bookingDate.getTime() >= today.getTime() && booking.status === 'confirmed';
      });

    const inProgressBookings = Array.from(this.facade.serviceBookings.values())
      .filter(booking => {
        const offering = this.facade.serviceOfferings.get(booking.offeringId);
        if (!offering || offering.storeId !== resource.storeId) return false;

        const dependencies = this.getResourceDependenciesByService(offering.templateId);
        return dependencies.some(d => d.requiredResources.includes(resourceId));
      })
      .filter(booking => booking.status === 'in_progress');

    resource.currentCapacity = {
      totalSlotsAvailable: totalSlots,
      slotsReserved: preReservations.length,
      slotsConfirmed: confirmedBookings.length,
      slotsInProgress: inProgressBookings.length,
      slotsAvailable: Math.max(0, totalSlots - preReservations.length - confirmedBookings.length - inProgressBookings.length),
      riskLevel: this.calculateRiskLevel(resource, totalSlots, preReservations.length + confirmedBookings.length + inProgressBookings.length),
    };

    if (resource.currentCapacity.slotsAvailable === 0 && resource.status === 'active') {
      this.updateServiceResourceStatus(resourceId, 'overloaded', 'Capacidade disponível zerada');
    } else if (resource.currentCapacity.slotsAvailable > 0 && resource.status === 'overloaded') {
      this.updateServiceResourceStatus(resourceId, 'active', 'Capacidade disponível restaurada');
    }

    this.updateResourceCapacityMetrics(resourceId);
    this.serviceResources.set(resourceId, resource);
  }

  private calculateRiskLevel(
    resource: ServiceResource,
    totalSlots: number,
    utilizedSlots: number
  ): 'low' | 'medium' | 'high' {
    if (totalSlots === 0) return 'high';

    const utilizationRate = utilizedSlots / totalSlots;
    const historicalMetrics = resource.historicalMetrics;

    if (utilizationRate >= 0.9) return 'high';
    if (utilizationRate >= 0.7) return 'medium';

    if (historicalMetrics.slaExecutionRate < 0.7) return 'high';
    if (historicalMetrics.slaExecutionRate < 0.85) return 'medium';
    if (historicalMetrics.overrunRate > 0.3) return 'high';
    if (historicalMetrics.overrunRate > 0.15) return 'medium';

    return 'low';
  }

  private updateResourceCapacityMetrics(resourceId: string): void {
    const resource = this.serviceResources.get(resourceId);
    if (!resource) return;

    const capacity = resource.currentCapacity;
    const metrics = resource.historicalMetrics;

    const capacityMetrics: ResourceCapacityMetrics = {
      resourceId: resourceId,
      resourceName: resource.name,
      storeId: resource.storeId,
      capacityTotal: capacity.totalSlotsAvailable,
      capacityReserved: capacity.slotsReserved,
      capacityConfirmed: capacity.slotsConfirmed,
      capacityInProgress: capacity.slotsInProgress,
      capacityUtilized: capacity.slotsReserved + capacity.slotsConfirmed + capacity.slotsInProgress,
      capacityAvailable: capacity.slotsAvailable,
      riskSla: capacity.riskLevel,
      riskFactors: this.getRiskFactors(resource, capacity),
      historicalAverageUtilization: metrics.totalServicesCompleted > 0
        ? (metrics.last30DaysServices / 30) / capacity.totalSlotsAvailable
        : 0,
      historicalPeakUtilization: Math.min(1.0, metrics.last30DaysServices / capacity.totalSlotsAvailable),
      calculatedAt: new Date().toISOString(),
      immutable: true,
    };

    this.resourceCapacityMetrics.set(resourceId, capacityMetrics);
  }

  private getRiskFactors(resource: ServiceResource, capacity: ServiceResource['currentCapacity']): string[] {
    const factors: string[] = [];

    if (capacity.slotsAvailable === 0) {
      factors.push('Capacidade zerada');
    }

    if (capacity.riskLevel === 'high') {
      factors.push('Alto risco de quebra de SLA');
    }

    const metrics = resource.historicalMetrics;
    if (metrics.overrunRate > 0.2) {
      factors.push('Alta taxa de atrasos históricos');
    }

    if (metrics.slaExecutionRate < 0.8) {
      factors.push('Taxa de execução dentro do SLA abaixo do esperado');
    }

    if (metrics.cancellationRate > 0.15) {
      factors.push('Alta taxa de cancelamento');
    }

    return factors;
  }

  recalculateCompanyCapacity(storeId: string): void {
    const resources = this.getServiceResourcesByStore(storeId)
      .filter(r => r.status === 'active' || r.status === 'overloaded');

    if (resources.length === 0) {
      return;
    }

    for (const resource of resources) {
      this.recalculateResourceCapacity(resource.resourceId);
    }

    let totalCapacity = 0;
    let utilizedCapacity = 0;
    let availableCapacity = 0;
    const bottleneckResources: Array<{
      resourceId: string;
      resourceName: string;
      utilizationRate: number;
      riskLevel: 'low' | 'medium' | 'high';
    }> = [];

    for (const resource of resources) {
      const capacity = resource.currentCapacity;
      totalCapacity += capacity.totalSlotsAvailable;
      utilizedCapacity += capacity.slotsReserved + capacity.slotsConfirmed + capacity.slotsInProgress;
      availableCapacity += capacity.slotsAvailable;

      const utilizationRate = capacity.totalSlotsAvailable > 0
        ? (capacity.slotsReserved + capacity.slotsConfirmed + capacity.slotsInProgress) / capacity.totalSlotsAvailable
        : 0;

      if (utilizationRate > 0.8) {
        bottleneckResources.push({
          resourceId: resource.resourceId,
          resourceName: resource.name,
          utilizationRate: utilizationRate,
          riskLevel: capacity.riskLevel,
        });
      }
    }

    const saturationRate = totalCapacity > 0 ? utilizedCapacity / totalCapacity : 0;
    const rejectedCount = 0;

    const companyMetrics: CompanyCapacityMetrics = {
      companyId: storeId,
      storeId: storeId,
      period: {
        start: new Date().toISOString(),
        end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      totalCapacity: totalCapacity,
      utilizedCapacity: utilizedCapacity,
      availableCapacity: availableCapacity,
      bottleneckResources: bottleneckResources,
      saturationRate: saturationRate,
      rejectedServicesCount: rejectedCount,
      rejectedServicesLast30Days: rejectedCount,
      calculatedAt: new Date().toISOString(),
      immutable: true,
    };

    this.companyCapacityMetrics.set(storeId, companyMetrics);
  }

  getCompanyCapacityMetrics(storeId: string): CompanyCapacityMetrics | null {
    this.recalculateCompanyCapacity(storeId);
    return this.companyCapacityMetrics.get(storeId) || null;
  }

  getResourceCapacityMetrics(resourceId: string): ResourceCapacityMetrics | null {
    this.recalculateResourceCapacity(resourceId);
    return this.resourceCapacityMetrics.get(resourceId) || null;
  }

  checkResourceAvailability(
    serviceTemplateId: string,
    storeId: string,
    date: string,
    time: string
  ): {
    available: boolean;
    missing_resources: string[];
    available_resources: string[];
  } {
    const dependencies = this.getResourceDependenciesByService(serviceTemplateId);

    if (dependencies.length === 0) {
      return {
        available: true,
        missing_resources: [],
        available_resources: [],
      };
    }

    const requiredResources: string[] = [];
    for (const dep of dependencies) {
      if (dep.allRequired) {
        requiredResources.push(...dep.requiredResources);
      } else {
        requiredResources.push(...dep.requiredResources);
      }
    }

    const availableResources: string[] = [];
    const missingResources: string[] = [];

    for (const resourceId of requiredResources) {
      const resource = this.serviceResources.get(resourceId);
      if (!resource) {
        missingResources.push(resourceId);
        continue;
      }

      if (resource.storeId !== storeId) {
        missingResources.push(resourceId);
        continue;
      }

      if (resource.status === 'overloaded' || resource.status === 'unavailable') {
        missingResources.push(resourceId);
        continue;
      }

      if (resource.currentCapacity.slotsAvailable <= 0) {
        missingResources.push(resourceId);
        continue;
      }

      availableResources.push(resourceId);
    }

    const allRequired = dependencies.every(d => d.allRequired);
    const available = allRequired
      ? missingResources.length === 0
      : availableResources.length > 0;

    return {
      available,
      missing_resources: missingResources,
      available_resources: availableResources,
    };
  }

  /** Exposto para a facade registrar eventos de capacidade (ex: rejeição por capacidade). */
  recordCapacityEvent(event: Omit<CapacityEvent, 'eventId' | 'createdAt' | 'immutable'>): void {
    const eventId = `capacity-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const capacityEvent: CapacityEvent = {
      eventId,
      ...event,
      createdAt: new Date().toISOString(),
      immutable: true,
    };

    this.capacityEvents.set(eventId, capacityEvent);

    if (event.eventType === 'service_rejected_capacity') {
      const facadeAny = this.facade;
      if (typeof facadeAny.generateEconomicEvent === 'function') {
        facadeAny.generateEconomicEvent({
          type: 'service_rejected_capacity',
          region: 'local',
          actorId: event.storeId,
          reference_id: event.details.serviceRequestId,
          amountCents: undefined,
          currency: null,
          visibility: 'restricted',
        });
      }
    }
  }

  getEligibleResourcesForMatching(storeId: string, serviceTemplateId: string): ServiceResource[] {
    const resources = this.getServiceResourcesByStore(storeId)
      .filter(r => {
        if (r.status !== 'active') return false;

        const dependencies = this.getResourceDependenciesByService(serviceTemplateId);
        if (dependencies.length === 0) return true;

        return dependencies.some(d => d.requiredResources.includes(r.resourceId));
      })
      .filter(r => r.currentCapacity.slotsAvailable > 0);

    return resources;
  }

  setResourceCompensationConfig(
    resourceId: string,
    config: Omit<ResourceCompensationConfig, 'resourceId' | 'createdAt' | 'updatedAt' | 'immutable'>
  ): ResourceCompensationConfig {
    const now = new Date().toISOString();
    const existing = this.resourceCompensationConfigs.get(resourceId);

    const compensationConfig: ResourceCompensationConfig = {
      resourceId: resourceId,
      ...config,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      immutable: false,
    };

    this.resourceCompensationConfigs.set(resourceId, compensationConfig);

    const resource = this.serviceResources.get(resourceId);
    if (resource) {
      resource.compensationConfig = {
        model: config.compensationModel,
        percentValue: config.percentValueBps,
        fixedAmount: config.fixedAmountCents,
        monthlySalary: config.monthlySalaryCents,
        baseSalary: config.baseSalaryCents,
        variablePercent: config.variablePercentBps,
        minCompensation: config.minCompensationCents,
        maxCompensation: config.maxCompensationCents,
        isActive: config.isActive,
        effectiveFrom: config.effectiveFrom,
        effectiveUntil: config.effectiveUntil,
      };
      resource.updatedAt = now;
      this.serviceResources.set(resourceId, resource);
    }

    marketplaceLogger.init('Configuração de compensação atualizada', {
      resourceId: resourceId,
      model: config.compensationModel,
    });

    return compensationConfig;
  }

  getResourceCompensationConfig(resourceId: string): ResourceCompensationConfig | null {
    return this.resourceCompensationConfigs.get(resourceId) || null;
  }

  /** TEMP compatibility layer (post-refactor): set resource by id. */
  setServiceResource(resourceId: string, resource: ServiceResource): void {
    this.serviceResources.set(resourceId, resource);
  }

  /** TEMP compatibility layer (post-refactor): set resource capacity metrics. */
  setResourceCapacityMetrics(resourceId: string, metrics: ResourceCapacityMetrics): void {
    this.resourceCapacityMetrics.set(resourceId, metrics);
  }

  /** TEMP compatibility layer (post-refactor): set company capacity metrics. */
  setCompanyCapacityMetrics(storeId: string, metrics: CompanyCapacityMetrics): void {
    this.companyCapacityMetrics.set(storeId, metrics);
  }

  /** Exposto para a facade (ex.: relatórios regionais de capacidade). */
  getCapacityEventsMap(): Map<string, CapacityEvent> {
    return this.capacityEvents;
  }
}