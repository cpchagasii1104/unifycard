// backend/src/modules/marketplace/resource-compensation.service.ts
// Módulo isolado de Compensação de Recursos
// Extraído de marketplace.service.ts para reduzir acoplamento

import { marketplaceLogger } from './marketplace.logger';
import type {
  ServiceResource,
  CompensationModel,
  ResourceCompensationConfig,
  ResourceCompensation,
  ResourceCompensationHistory,
  CompanyCompensationReport,
} from '@contracts/marketplace';

export class ResourceCompensationService {
  constructor(
    private serviceResources: Map<string, ServiceResource>,
    private resourceCompensations: Map<string, ResourceCompensation>,
    private resourceCompensationConfigs: Map<string, ResourceCompensationConfig>
  ) {}

  /**
   * Configurar modelo de compensação para um recurso
   */
  setResourceCompensationConfig(
    resourceId: string,
    config: Omit<ResourceCompensationConfig, 'resourceId' | 'createdAt' | 'updatedAt' | 'immutable'>
  ): ResourceCompensationConfig {
    const now = new Date().toISOString();
    const existing = this.resourceCompensationConfigs.get(resourceId);

    const compensationConfig: ResourceCompensationConfig = {
      resourceId: resourceId,
      compensationModel: config.compensationModel,
      percentValueBps: config.percentValueBps,
      fixedAmountCents: config.fixedAmountCents,
      currency: config.currency,
      monthlySalaryCents: config.monthlySalaryCents,
      baseSalaryCents: config.baseSalaryCents,
      variablePercentBps: config.variablePercentBps,
      minCompensationCents: config.minCompensationCents,
      maxCompensationCents: config.maxCompensationCents,
      isActive: config.isActive,
      effectiveFrom: config.effectiveFrom,
      effectiveUntil: config.effectiveUntil,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      immutable: false,
    };

    this.resourceCompensationConfigs.set(resourceId, compensationConfig);

    // Atualizar ServiceResource com a configuração
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
      resource_id: resourceId,
      model: config.compensationModel,
    });

    return compensationConfig;
  }

  /**
   * Buscar configuração de compensação de um recurso
   */
  getResourceCompensationConfig(resourceId: string): ResourceCompensationConfig | null {
    return this.resourceCompensationConfigs.get(resourceId) || null;
  }

  /**
   * Calcular compensação para um recurso após conclusão de serviço
   */
  calculateResourceCompensation(
    resourceId: string,
    serviceOrderId: string,
    serviceBookingId: string,
    serviceValue: { amountCents: number; currency: string }
  ): ResourceCompensation {
    const resource = this.serviceResources.get(resourceId);
    if (!resource) {
      throw new Error('Recurso não encontrado');
    }

    const config = this.resourceCompensationConfigs.get(resourceId);
    if (!config || !config.isActive) {
      // Sem configuração ou inativa = modelo 'none' (100% fica na empresa)
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

    // Verificar se está dentro do período de vigência
    const now = new Date();
    const effectiveFrom = new Date(config.effectiveFrom);
    if (now < effectiveFrom) {
      throw new Error('Configuração de compensação ainda não está em vigência');
    }

    if (config.effectiveUntil) {
      const effectiveUntil = new Date(config.effectiveUntil);
      if (now > effectiveUntil) {
        throw new Error('Configuração de compensação expirou');
      }
    }

    let compensationAmount = 0;
    const calculationDetails: ResourceCompensation['calculationDetails'] = {
      adjustments: [],
    };

    // Calcular compensação baseado no modelo
    switch (config.compensationModel) {
      case 'none':
        compensationAmount = 0;
        break;

      case 'fixed_percent':
        if (!config.percentValueBps) {
          throw new Error('Percentual não configurado para modelo fixed_percent');
        }
        compensationAmount = Math.round((serviceValue.amountCents * config.percentValueBps) / 10000);
        calculationDetails.baseValue = serviceValue.amountCents;
        calculationDetails.percentApplied = config.percentValueBps;
        break;

      case 'fixed_value':
        if (!config.fixedAmountCents) {
          throw new Error('Valor fixo não configurado para modelo fixed_value');
        }
        compensationAmount = config.fixedAmountCents;
        calculationDetails.fixedValueApplied = config.fixedAmountCents;
        break;

      case 'salary':
        // Funcionário assalariado não gera repasse por serviço
        compensationAmount = 0;
        break;

      case 'mixed':
        if (!config.baseSalaryCents || !config.variablePercentBps) {
          throw new Error('Salário base ou percentual variável não configurado para modelo mixed');
        }
        // Variável: percentual sobre o valor do serviço
        const variableAmount = Math.round((serviceValue.amountCents * config.variablePercentBps) / 10000);
        compensationAmount = variableAmount;
        calculationDetails.baseValue = serviceValue.amountCents;
        calculationDetails.percentApplied = config.variablePercentBps;
        break;
    }

    // Aplicar limites mínimo e máximo
    if (config.minCompensationCents !== undefined && compensationAmount < config.minCompensationCents) {
      const adjustment = config.minCompensationCents - compensationAmount;
      compensationAmount = config.minCompensationCents;
      if (!calculationDetails.adjustments) {
        calculationDetails.adjustments = [];
      }
      calculationDetails.adjustments.push({
        type: 'min_limit',
        amountCents: adjustment,
        reason: `Aplicado limite mínimo de ${config.minCompensationCents / 100} ${serviceValue.currency}`,
      });
    }

    if (config.maxCompensationCents !== undefined && compensationAmount > config.maxCompensationCents) {
      const adjustment = compensationAmount - config.maxCompensationCents;
      compensationAmount = config.maxCompensationCents;
      if (!calculationDetails.adjustments) {
        calculationDetails.adjustments = [];
      }
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
      { amountCents: compensationAmount, currency: serviceValue.currency },
      calculationDetails
    );
  }

  /**
   * Criar registro de compensação
   */
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
    const compensationId = `compensation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const compensation: ResourceCompensation = {
      compensationId: compensationId,
      resourceId: resourceId,
      serviceOrderId: serviceOrderId,
      serviceBookingId: serviceBookingId,
      storeId: storeId,
      serviceValue: serviceValue,
      compensationAmount: compensationAmount,
      compensationModel: model,
      calculationDetails: calculationDetails,
      status: 'calculated',
      createdAt: now,
      updatedAt: now,
      immutable: true,
    };

    this.resourceCompensations.set(compensationId, compensation);

    marketplaceLogger.init('Compensação calculada', {
      compensation_id: compensationId,
      resource_id: resourceId,
      service_order_id: serviceOrderId,
      amountCents: compensationAmount.amountCents,
      model,
    });

    return compensation;
  }

  /**
   * Registrar repasse interno no ledger (tipo: resource_compensation)
   */
  async recordResourceCompensationLedger(
    compensation: ResourceCompensation,
    companyStoreId: string,
    resourceId: string
  ): Promise<string> {
    // Integração com UnifyBank (usar bankPortsRegistry)
    // Por enquanto, retornar ID simulado
    // TODO: Implementar integração real com ledger quando disponível
    const ledgerEntryId = `ledger-resource-compensation-${compensation.compensationId}`;

    marketplaceLogger.init('Repasse interno registrado no ledger', {
      compensation_id: compensation.compensationId,
      resource_id: resourceId,
      amountCents: compensation.compensationAmount.amountCents,
      ledger_entry_id: ledgerEntryId,
    });

    return ledgerEntryId;
  }

  /**
   * Marcar compensação como paga
   */
  markCompensationAsPaid(compensationId: string): ResourceCompensation | null {
    const compensation = this.resourceCompensations.get(compensationId);
    if (!compensation) {
      return null;
    }

    compensation.status = 'paid';
    compensation.paidAt = new Date().toISOString();
    compensation.updatedAt = new Date().toISOString();

    this.resourceCompensations.set(compensationId, compensation);

    marketplaceLogger.init('Compensação marcada como paga', {
      compensation_id: compensationId,
      resource_id: compensation.resourceId,
    });

    return compensation;
  }

  /**
   * Buscar compensações de um recurso
   */
  getResourceCompensations(
    resourceId: string,
    options?: {
      startsAt?: string;
      endsAt?: string;
      status?: ResourceCompensation['status'];
    }
  ): ResourceCompensation[] {
    let compensations = Array.from(this.resourceCompensations.values())
      .filter(c => c.resourceId === resourceId);

    if (options?.startsAt) {
      compensations = compensations.filter(c => c.createdAt >= options.startsAt!);
    }

    if (options?.endsAt) {
      compensations = compensations.filter(c => c.createdAt <= options.endsAt!);
    }

    if (options?.status) {
      compensations = compensations.filter(c => c.status === options.status);
    }

    return compensations.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Buscar compensações de uma empresa (todos os recursos)
   */
  getCompanyCompensations(
    storeId: string,
    options?: {
      startsAt?: string;
      endsAt?: string;
      status?: ResourceCompensation['status'];
    }
  ): ResourceCompensation[] {
    // Buscar recursos da empresa
    const resources = Array.from(this.serviceResources.values())
      .filter(r => r.storeId === storeId);
    const resourceIds = resources.map(r => r.resourceId);

    let compensations = Array.from(this.resourceCompensations.values())
      .filter(c => resourceIds.includes(c.resourceId));

    if (options?.startsAt) {
      compensations = compensations.filter(c => c.createdAt >= options.startsAt!);
    }

    if (options?.endsAt) {
      compensations = compensations.filter(c => c.createdAt <= options.endsAt!);
    }

    if (options?.status) {
      compensations = compensations.filter(c => c.status === options.status);
    }

    return compensations.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Gerar histórico de compensações por recurso
   */
  generateResourceCompensationHistory(
    resourceId: string,
    startDate: string,
    endDate: string
  ): ResourceCompensationHistory {
    const compensations = this.getResourceCompensations(resourceId, {
      startsAt: startDate,
      endsAt: endDate,
    });

    const totalCompensation = compensations.reduce(
      (sum, c) => sum + c.compensationAmount.amountCents,
      0
    );

    const byModel: Record<CompensationModel, { count: number; totalCents: number }> = {
      none: { count: 0, totalCents: 0 },
      fixed_percent: { count: 0, totalCents: 0 },
      fixed_value: { count: 0, totalCents: 0 },
      salary: { count: 0, totalCents: 0 },
      mixed: { count: 0, totalCents: 0 },
    };

    for (const comp of compensations) {
      const model = comp.compensationModel;
      byModel[model].count += 1;
      byModel[model].totalCents += comp.compensationAmount.amountCents;
    }

    const history: ResourceCompensationHistory = {
      resourceId: resourceId,
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
      byModel: byModel,
      generatedAt: new Date().toISOString(),
      immutable: true,
    };

    return history;
  }

  /**
   * Gerar relatório contábil de compensações por empresa
   */
  generateCompanyCompensationReport(
    storeId: string,
    startDate: string,
    endDate: string
  ): CompanyCompensationReport {
    const compensations = this.getCompanyCompensations(storeId, {
      startsAt: startDate,
      endsAt: endDate,
    });

    const resources = Array.from(this.serviceResources.values())
      .filter(r => r.storeId === storeId);
    const totalCompensation = compensations.reduce(
      (sum, c) => sum + c.compensationAmount.amountCents,
      0
    );

    // Por recurso
    const byResourceMap = new Map<string, {
      resourceId: string;
      resourceName: string;
      compensationModel: CompensationModel;
      servicesCount: number;
      totalCompensation: {
        amountCents: number;
        currency: string;
      };
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
          totalCompensation: {
            amountCents: comp.compensationAmount.amountCents,
            currency: comp.compensationAmount.currency,
          },
        });
      }
    }

    // Por modelo
    const byModel: Record<CompensationModel, {
      resourcesCount: number;
      servicesCount: number;
      totalCompensation: { amountCents: number; currency: string };
    }> = {
      none: { resourcesCount: 0, servicesCount: 0, totalCompensation: { amountCents: 0, currency: 'BRL' } },
      fixed_percent: { resourcesCount: 0, servicesCount: 0, totalCompensation: { amountCents: 0, currency: 'BRL' } },
      fixed_value: { resourcesCount: 0, servicesCount: 0, totalCompensation: { amountCents: 0, currency: 'BRL' } },
      salary: { resourcesCount: 0, servicesCount: 0, totalCompensation: { amountCents: 0, currency: 'BRL' } },
      mixed: { resourcesCount: 0, servicesCount: 0, totalCompensation: { amountCents: 0, currency: 'BRL' } },
    };

    const modelResources = new Set<string>();
    for (const comp of compensations) {
      const model = comp.compensationModel;
      byModel[model].servicesCount += 1;
      byModel[model].totalCompensation.amountCents += comp.compensationAmount.amountCents;
      modelResources.add(`${model}-${comp.resourceId}`);
    }

    for (const key of modelResources) {
      const [model] = key.split('-');
      byModel[model as CompensationModel].resourcesCount += 1;
    }

    const report: CompanyCompensationReport = {
      companyId: storeId, // Simplificação: storeId = companyId
      storeId: storeId,
      period: { start: startDate, end: endDate },
      totalCompensationsPaid: {
        amountCents: totalCompensation,
        currency: compensations[0]?.compensationAmount.currency || 'BRL',
      },
      totalResources: resources.length,
      totalServices: compensations.length,
      byResource: Array.from(byResourceMap.values()),
      byModel: byModel,
      generatedAt: new Date().toISOString(),
      immutable: true,
    };

    return report;
  }
}

