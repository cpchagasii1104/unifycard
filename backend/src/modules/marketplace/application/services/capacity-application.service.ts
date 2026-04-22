// backend/src/modules/marketplace/application/services/capacity-application.service.ts
// Application Service: orquestração do domínio Capacity (delegação ao domain module + compensações).

import type { MarketplaceCapacityModule } from '../../domain/capacity/marketplace-capacity.service';
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
} from '@contracts/marketplace';
import type { CompensationModel } from '@contracts/marketplace';
import { isUseBankRegionalFundEnabled } from '@core/features/use-bank-regional-fund';
import { v4 as uuidv4 } from 'uuid';
import { bankAccountService } from '../../../bank/bank-account.service';
import { bankTransactionService } from '../../../bank/bank-transaction.service';
import { buildSystemAuthorship } from '../../../bank/financial-authorship.helper';
import { resolveIncentiveRecipientAccountId } from '../../marketplace-regional-fund-bank.helpers';
import { marketplaceLogger } from '../../marketplace.logger';

export interface ICapacityCompensationStore {
  get(compensationId: string): ResourceCompensation | null;
  set(compensationId: string, compensation: ResourceCompensation): void;
  getMap(): Map<string, ResourceCompensation>;
}

export class CapacityApplicationService {
  constructor(
    private readonly capacityModule: MarketplaceCapacityModule,
    private readonly compensationStore?: ICapacityCompensationStore
  ) {}

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
    return this.capacityModule.createOrUpdateServiceResource(storeId, type, name, options);
  }

  getServiceResource(resourceId: string): ServiceResource | null {
    return this.capacityModule.getServiceResource(resourceId);
  }

  getServiceResourcesByStore(storeId: string): ServiceResource[] {
    return this.capacityModule.getServiceResourcesByStore(storeId);
  }

  updateServiceResourceStatus(
    resourceId: string,
    status: ServiceResourceStatus,
    reason?: string
  ): ServiceResource | null {
    return this.capacityModule.updateServiceResourceStatus(resourceId, status, reason);
  }

  createResourceDependency(
    serviceTemplateId: string,
    requiredResourceIds: string[],
    allRequired: boolean = true
  ): ServiceResourceDependency {
    return this.capacityModule.createResourceDependency(
      serviceTemplateId,
      requiredResourceIds,
      allRequired
    );
  }

  getResourceDependenciesByService(serviceTemplateId: string): ServiceResourceDependency[] {
    return this.capacityModule.getResourceDependenciesByService(serviceTemplateId);
  }

  recalculateResourceCapacity(resourceId: string): void {
    this.capacityModule.recalculateResourceCapacity(resourceId);
  }

  recalculateCompanyCapacity(storeId: string): void {
    this.capacityModule.recalculateCompanyCapacity(storeId);
  }

  getCompanyCapacityMetrics(storeId: string): CompanyCapacityMetrics | null {
    return this.capacityModule.getCompanyCapacityMetrics(storeId);
  }

  getResourceCapacityMetrics(resourceId: string): ResourceCapacityMetrics | null {
    return this.capacityModule.getResourceCapacityMetrics(resourceId);
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
    return this.capacityModule.checkResourceAvailability(
      serviceTemplateId,
      storeId,
      date,
      time
    );
  }

  getEligibleResourcesForMatching(
    storeId: string,
    serviceTemplateId: string
  ): ServiceResource[] {
    return this.capacityModule.getEligibleResourcesForMatching(storeId, serviceTemplateId);
  }

  getCapacityEventsMap(): Map<string, CapacityEvent> {
    return this.capacityModule.getCapacityEventsMap();
  }

  setResourceCompensationConfig(
    resourceId: string,
    config: Omit<
      ResourceCompensationConfig,
      'resourceId' | 'createdAt' | 'updatedAt' | 'immutable'
    >
  ): ResourceCompensationConfig {
    return this.capacityModule.setResourceCompensationConfig(resourceId, config);
  }

  getResourceCompensationConfig(resourceId: string): ResourceCompensationConfig | null {
    return this.capacityModule.getResourceCompensationConfig(resourceId);
  }

  // ---------- Compensations (lógica extraída da facade) ----------

  calculateResourceCompensation(
    resourceId: string,
    serviceOrderId: string,
    serviceBookingId: string,
    serviceValue: { amountCents: number; currency: string }
  ): ResourceCompensation {
    if (!this.compensationStore) {
      throw new Error('CapacityApplicationService: compensationStore not injected');
    }
    const resource = this.capacityModule.getServiceResource(resourceId);
    if (!resource) throw new Error('Recurso não encontrado');
    const config = this.capacityModule.getResourceCompensationConfig(resourceId);
    if (!config || !config.isActive) {
      return this.createCompensationRecord(
        resourceId,
        serviceOrderId,
        serviceBookingId,
        resource.storeId,
        serviceValue,
        'none',
        { amountCents: 0, currency: serviceValue.currency },
        {}
      );
    }
    const now = new Date();
    const effectiveFrom = new Date(config.effectiveFrom);
    if (now < effectiveFrom) throw new Error('Configuração de compensação ainda não está em vigência');
    if (config.effectiveUntil) {
      const effectiveUntil = new Date(config.effectiveUntil);
      if (now > effectiveUntil) throw new Error('Configuração de compensação expirou');
    }
    let compensationAmountCents = 0;
    const calculationDetails: ResourceCompensation['calculationDetails'] = { adjustments: [] };
    switch (config.compensationModel) {
      case 'none':
        compensationAmountCents = 0;
        break;
      case 'fixed_percent':
        if (config.percentValueBps == null) throw new Error('Percentual não configurado para modelo fixed_percent');
        compensationAmountCents = Math.round((serviceValue.amountCents * config.percentValueBps) / 100);
        calculationDetails.baseValue = serviceValue.amountCents;
        calculationDetails.percentApplied = config.percentValueBps;
        break;
      case 'fixed_value':
        if (config.fixedAmountCents == null) throw new Error('Valor fixo não configurado para modelo fixed_value');
        compensationAmountCents = config.fixedAmountCents;
        calculationDetails.fixedValueApplied = config.fixedAmountCents;
        break;
      case 'salary':
        compensationAmountCents = 0;
        break;
      case 'mixed':
        if (config.baseSalaryCents == null || config.variablePercentBps == null) {
          throw new Error('Salário base ou percentual variável não configurado para modelo mixed');
        }
        compensationAmountCents = Math.round((serviceValue.amountCents * config.variablePercentBps) / 100);
        calculationDetails.baseValue = serviceValue.amountCents;
        calculationDetails.percentApplied = config.variablePercentBps;
        break;
    }
    if (config.minCompensationCents != null && compensationAmountCents < config.minCompensationCents) {
      const adjustment = config.minCompensationCents - compensationAmountCents;
      compensationAmountCents = config.minCompensationCents;
      calculationDetails.adjustments = calculationDetails.adjustments || [];
      calculationDetails.adjustments.push({
        type: 'min_limit',
        amountCents: adjustment,
        reason: `Aplicado limite mínimo de ${config.minCompensationCents / 100} ${serviceValue.currency}`,
      });
    }
    if (config.maxCompensationCents != null && compensationAmountCents > config.maxCompensationCents) {
      const adjustment = compensationAmountCents - config.maxCompensationCents;
      compensationAmountCents = config.maxCompensationCents;
      calculationDetails.adjustments = calculationDetails.adjustments || [];
      calculationDetails.adjustments.push({
        type: 'max_limit',
        amountCents: -adjustment,
        reason: `Aplicado limite máximo de ${config.maxCompensationCents / 100} ${serviceValue.currency}`,
      });
    }
    return this.createCompensationRecord(
      resourceId,
      serviceOrderId,
      serviceBookingId,
      resource.storeId,
      serviceValue,
      config.compensationModel,
      { amountCents: compensationAmountCents, currency: serviceValue.currency },
      calculationDetails
    );
  }

  private createCompensationRecord(
    resourceId: string,
    serviceOrderId: string,
    serviceBookingId: string,
    storeId: string,
    serviceValue: { amountCents: number; currency: string },
    model: CompensationModel,
    compensationAmount: { amountCents: number; currency: string },
    calculationDetails: ResourceCompensation['calculationDetails']
  ): ResourceCompensation {
    if (!this.compensationStore) throw new Error('compensationStore not injected');
    const compensationId = uuidv4();
    const now = new Date().toISOString();
    const compensation: ResourceCompensation = {
      compensationId,
      resourceId,
      serviceOrderId,
      serviceBookingId,
      storeId,
      serviceValue,
      compensationAmount,
      compensationModel: model,
      calculationDetails,
      status: 'calculated',
      createdAt: now,
      updatedAt: now,
      immutable: true,
    };
    this.compensationStore.set(compensationId, compensation);
    marketplaceLogger.init('Compensação calculada', {
      compensationId,
      resourceId,
      serviceOrderId,
      amountCents: compensationAmount.amountCents,
      model,
    });
    return compensation;
  }

  async recordResourceCompensationLedger(
    tenantId: string,
    compensation: ResourceCompensation,
    companyStoreId: string,
    resourceId: string
  ): Promise<string> {
    if (!isUseBankRegionalFundEnabled()) {
      const ledgerEntryId = `ledger-resource-compensation-${compensation.compensationId}`;
      marketplaceLogger.init('Repasse interno registrado no ledger (stub)', {
        compensationId: compensation.compensationId,
        resourceId: compensation.resourceId,
        amountCents: compensation.compensationAmount.amountCents,
        ledgerEntryId,
      });
      return ledgerEntryId;
    }

    const resource = this.getServiceResource(resourceId);
    if (!resource?.actorId) {
      throw new Error(
        'USE_BANK_REGIONAL_FUND: recurso sem actorId; não é possível executar resource_compensation no Bank.'
      );
    }

    const destAccountId = await resolveIncentiveRecipientAccountId(tenantId, resource.actorId, 'BRL');
    if (!destAccountId) {
      throw new Error(
        'USE_BANK_REGIONAL_FUND: destino da compensação não resolvido (user_wallet ou seller_available).'
      );
    }

    await bankAccountService.ensurePlatformAccounts(tenantId, 'BRL');
    const platformRevenue = await bankAccountService.getPlatformLifecycleAccount(
      tenantId,
      'platform_revenue',
      'BRL'
    );
    if (!platformRevenue) {
      throw new Error('Conta platform_revenue não disponível para compensação de recurso');
    }

    // C54: Gate financeiro obrigatório antes de transfer (AUTHORITY_PRECEDENCE §4.1)
    const { requireFinancialRiskClearance } = await import('@modules/risk-identity/risk-financial-gate');
    await requireFinancialRiskClearance(tenantId, {
      actorId: resource.actorId,
      action: 'financial_payout',
      amountCents: compensation.compensationAmount.amountCents,
    });

    const eventId = compensation.compensationId;
    const result = await bankTransactionService.transfer(tenantId, {
      eventId,
      fromAccountId: platformRevenue.accountId,
      toAccountId: destAccountId,
      amountCents: compensation.compensationAmount.amountCents,
      currency: 'BRL',
      transactionType: 'transfer',
      description: `Resource compensation (${compensation.compensationId})`,
      metadata: {
        resource_id: resourceId,
        store_id: companyStoreId,
        service_order_id: compensation.serviceOrderId,
        service_booking_id: compensation.serviceBookingId,
      },
      referenceType: 'resource_compensation',
      referenceId: compensation.compensationId,
      authorship: buildSystemAuthorship({ actingForAccountId: platformRevenue.accountId }),
      treasurySource: 'treasury:settlement',
    });

    marketplaceLogger.init('Compensação registrada no Bank', {
      compensationId: compensation.compensationId,
      resourceId,
      amountCents: compensation.compensationAmount.amountCents,
      bank_transaction_id: result.transactionId,
    });
    return result.transactionId;
  }

  markCompensationAsPaid(compensationId: string): ResourceCompensation | null {
    if (!this.compensationStore) return null;
    const compensation = this.compensationStore.get(compensationId);
    if (!compensation) return null;
    compensation.status = 'paid';
    compensation.paidAt = new Date().toISOString();
    compensation.updatedAt = new Date().toISOString();
    this.compensationStore.set(compensationId, compensation);
    marketplaceLogger.init('Compensação marcada como paga', { compensationId, resourceId: compensation.resourceId });
    return compensation;
  }

  getResourceCompensations(
    resourceId: string,
    options?: { starts_at?: string; ends_at?: string; status?: ResourceCompensation['status'] }
  ): ResourceCompensation[] {
    if (!this.compensationStore) return [];
    let compensations = Array.from(this.compensationStore.getMap().values()).filter(c => c.resourceId === resourceId);
    if (options?.starts_at != null) compensations = compensations.filter(c => c.createdAt >= options.starts_at!);
    if (options?.ends_at != null) compensations = compensations.filter(c => c.createdAt <= options.ends_at!);
    if (options?.status) compensations = compensations.filter(c => c.status === options.status);
    return compensations.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getCompanyCompensations(
    storeId: string,
    options?: { starts_at?: string; ends_at?: string; status?: ResourceCompensation['status'] }
  ): ResourceCompensation[] {
    if (!this.compensationStore) return [];
    const resources = this.capacityModule.getServiceResourcesByStore(storeId);
    const resourceIds = resources.map(r => r.resourceId);
    let compensations = Array.from(this.compensationStore.getMap().values()).filter(c => resourceIds.includes(c.resourceId));
    if (options?.starts_at != null) compensations = compensations.filter(c => c.createdAt >= options.starts_at!);
    if (options?.ends_at != null) compensations = compensations.filter(c => c.createdAt <= options.ends_at!);
    if (options?.status) compensations = compensations.filter(c => c.status === options.status);
    return compensations.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  generateResourceCompensationHistory(
    resourceId: string,
    startDate: string,
    endDate: string
  ): ResourceCompensationHistory {
    const compensations = this.getResourceCompensations(resourceId, { starts_at: startDate, ends_at: endDate });
    const totalCompensation = compensations.reduce((sum, c) => sum + c.compensationAmount.amountCents, 0);
    const byModel: Record<CompensationModel, { count: number; totalCents: number }> = {
      none: { count: 0, totalCents: 0 },
      fixed_percent: { count: 0, totalCents: 0 },
      fixed_value: { count: 0, totalCents: 0 },
      salary: { count: 0, totalCents: 0 },
      mixed: { count: 0, totalCents: 0 },
    };
    for (const comp of compensations) {
      byModel[comp.compensationModel].count += 1;
      byModel[comp.compensationModel].totalCents += comp.compensationAmount.amountCents;
    }
    return {
      resourceId,
      period: { start: startDate, end: endDate },
      compensations,
      totalServices: compensations.length,
      totalCompensation: {
        amountCents: totalCompensation,
        currency: compensations[0]?.compensationAmount.currency || 'BRL',
      },
      averagePerService: {
        amountCents: compensations.length > 0 ? Math.round(totalCompensation / compensations.length) : 0,
        currency: compensations[0]?.compensationAmount.currency || 'BRL',
      },
      byModel,
      generatedAt: new Date().toISOString(),
      immutable: true,
    };
  }

  generateCompanyCompensationReport(
    storeId: string,
    startDate: string,
    endDate: string
  ): CompanyCompensationReport {
    const compensations = this.getCompanyCompensations(storeId, { starts_at: startDate, ends_at: endDate });
    const resources = this.capacityModule.getServiceResourcesByStore(storeId);
    const totalCompensation = compensations.reduce((sum, c) => sum + c.compensationAmount.amountCents, 0);
    const byResourceMap = new Map<string, {
      resourceId: string;
      resourceName: string;
      compensationModel: CompensationModel;
      servicesCount: number;
      totalCompensation: { amountCents: number; currency: string };
    }>();
    for (const comp of compensations) {
      const resource = resources.find(r => r.resourceId === comp.resourceId);
      if (!resource) continue;
      const existing = byResourceMap.get(comp.resourceId);
      if (existing) {
        existing.servicesCount += 1;
        existing.totalCompensation.amountCents += comp.compensationAmount.amountCents;
      } else {
        byResourceMap.set(comp.resourceId, {
          resourceId: comp.resourceId,
          resourceName: resource.name,
          compensationModel: comp.compensationModel,
          servicesCount: 1,
          totalCompensation: { amountCents: comp.compensationAmount.amountCents, currency: comp.compensationAmount.currency },
        });
      }
    }
    const byModel: Record<CompensationModel, { resourcesCount: number; servicesCount: number; totalCompensation: { amountCents: number; currency: string } }> = {
      none: { resourcesCount: 0, servicesCount: 0, totalCompensation: { amountCents: 0, currency: 'BRL' } },
      fixed_percent: { resourcesCount: 0, servicesCount: 0, totalCompensation: { amountCents: 0, currency: 'BRL' } },
      fixed_value: { resourcesCount: 0, servicesCount: 0, totalCompensation: { amountCents: 0, currency: 'BRL' } },
      salary: { resourcesCount: 0, servicesCount: 0, totalCompensation: { amountCents: 0, currency: 'BRL' } },
      mixed: { resourcesCount: 0, servicesCount: 0, totalCompensation: { amountCents: 0, currency: 'BRL' } },
    };
    const modelResources = new Set<string>();
    for (const comp of compensations) {
      byModel[comp.compensationModel].servicesCount += 1;
      byModel[comp.compensationModel].totalCompensation.amountCents += comp.compensationAmount.amountCents;
      modelResources.add(`${comp.compensationModel}-${comp.resourceId}`);
    }
    for (const key of modelResources) {
      const [model] = key.split('-');
      byModel[model as CompensationModel].resourcesCount += 1;
    }
    return {
      companyId: storeId,
      storeId,
      period: { start: startDate, end: endDate },
      totalCompensationsPaid: {
        amountCents: totalCompensation,
        currency: compensations[0]?.compensationAmount.currency || 'BRL',
      },
      totalResources: resources.length,
      totalServices: compensations.length,
      byResource: Array.from(byResourceMap.values()),
      byModel,
      generatedAt: new Date().toISOString(),
      immutable: true,
    };
  }
}