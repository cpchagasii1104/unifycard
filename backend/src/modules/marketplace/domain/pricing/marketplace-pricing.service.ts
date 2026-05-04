// backend/src/modules/marketplace/domain/pricing/marketplace-pricing.service.ts
// Domínio de precificação assistida: relatórios, break-even, margem, risco operacional.
// Single source of truth para estado de precificação; stores (Maps) ficam apenas aqui.

import type { MarketplaceService } from '../../marketplace.service';
import type {
  OperationalCostProfile,
  RealOperationMetrics,
  BreakEvenAnalysis,
  ServiceMarginAnalysis,
  PricingAssistanceReport,
  OperationalRiskLevel,
} from '@contracts/marketplace';
import { marketplaceLogger } from '../../marketplace.logger';

/** Forma mínima de ordem de serviço acessada via facade (any) */
interface ServiceOrderLike {
  createdAt: string;
  status: string;
  offeringId: string;
  requestId: string;
  price: { amountCents: number };
}

/** Forma mínima de request de dispatch */
interface ServiceRequestLike {
  requestId: string;
  createdAt: string;
  completedAt?: string;
  status: string;
}

/** Forma mínima de dispatch */
interface ServiceDispatchLike {
  requestId: string;
  status: string;
  createdAt?: string;
  acceptedAt?: string;
}

/** Forma mínima de offering para filtros */
interface ServiceOfferingLike {
  offering_id: string;
  storeId: string;
  templateId: string;
}

/** Domain service: dono do estado (Maps). Single source of truth para precificação assistida. */
export class MarketplacePricingDomainService {
  private pricingAssistanceReports: Map<string, PricingAssistanceReport> = new Map();
  private operationalCostProfiles: Map<string, OperationalCostProfile> = new Map();

  constructor(private readonly facade: MarketplaceService) {}

  getOperationalCostProfile(storeId: string): OperationalCostProfile | null {
    return this.operationalCostProfiles.get(storeId) ?? null;
  }

  setOperationalCostProfileById(storeId: string, profile: OperationalCostProfile): void {
    this.operationalCostProfiles.set(storeId, profile);
  }

  getOperationalCostProfilesMap(): Map<string, OperationalCostProfile> {
    return this.operationalCostProfiles;
  }

  calculateRealOperationMetrics(
    storeId: string,
    companyId: string,
    period: { start: string; end: string }
  ): RealOperationMetrics {
    const facadeAny = this.facade as any;
    const periodStart = new Date(period.start);
    const periodEnd = new Date(period.end);
    const serviceOrders = Array.from(facadeAny.serviceOrders.values())
      .filter((o: any) => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= periodStart && orderDate <= periodEnd && o.status === 'completed';
      })
      .filter((o: any) => {
        const offering = facadeAny.serviceOfferings.get(o.offeringId);
        if (!offering) return false;
        return offering.storeId === storeId;
      }) as ServiceOrderLike[];

    let totalRevenue = 0;
    for (const order of serviceOrders) {
      totalRevenue += order.price.amountCents;
    }
    const averageTicket = serviceOrders.length > 0 ? totalRevenue / serviceOrders.length : 0;

    let totalExecutionTime = 0;
    let executionTimeCount = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;
    for (const order of serviceOrders) {
      const request = Array.from(facadeAny.dispatchModule.getServiceRequestsMap().values())
        .find((r: any) => r.requestId === order.requestId) as ServiceRequestLike | undefined;
      if (request) {
        if (request.completedAt && request.createdAt) {
          totalExecutionTime += (new Date(request.completedAt).getTime() - new Date(request.createdAt).getTime()) / (1000 * 60);
          executionTimeCount++;
        }
        const dispatch = Array.from(facadeAny.dispatchModule.getServiceDispatchesMap().values())
          .find((d: any) => d.requestId === request.requestId && d.status === 'accepted') as ServiceDispatchLike | undefined;
        if (dispatch && dispatch.createdAt && dispatch.acceptedAt) {
          totalResponseTime += (new Date(dispatch.acceptedAt).getTime() - new Date(dispatch.createdAt).getTime()) / (1000 * 60);
          responseTimeCount++;
        }
      }
    }

    const avgExecutionTime = executionTimeCount > 0 ? totalExecutionTime / executionTimeCount : 0;
    const avgResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;

    const allRequests = Array.from(facadeAny.dispatchModule.getServiceRequestsMap().values())
      .filter((r: any) => {
        const requestDate = new Date(r.createdAt);
        return requestDate >= periodStart && requestDate <= periodEnd;
      })
      .filter((r: any) => {
        const offering = Array.from(facadeAny.serviceOfferings.values()).find((o: any) => {
          const order = serviceOrders.find((so) => so.requestId === r.requestId);
          return order && o.offering_id === order.offeringId;
        }) as ServiceOfferingLike | undefined;
        return !!offering;
      });

    const totalRequests = allRequests.length;
    const cancelledRequests = allRequests.filter((r: any) => r.status === 'cancelled' || r.status === 'expired').length;
    const cancellationRate = totalRequests > 0 ? cancelledRequests / totalRequests : 0;

    return {
      storeId,
      companyId,
      period,
      averageTicket: { amountCents: averageTicket, currency: 'BRL' },
      totalRevenue: { amountCents: totalRevenue, currency: 'BRL' },
      totalServices: serviceOrders.length,
      averageExecutionTimeMinutes: avgExecutionTime,
      averageResponseTimeMinutes: avgResponseTime,
      cancellationRate,
      cancelledServicesCount: cancelledRequests,
      totalRequestsCount: totalRequests,
      servicesAtLoss: 0,
      servicesAtLossPercentage: 0,
      totalLossAmount: { amountCents: 0, currency: 'BRL' },
      calculatedAt: new Date().toISOString(),
      immutable: true,
    };
  }

  calculateBreakEvenAnalysis(
    storeId: string,
    costProfile: OperationalCostProfile,
    operationMetrics: RealOperationMetrics
  ): BreakEvenAnalysis {
    const fixedCosts = costProfile.fixedCostsMonthly.totalCents.amountCents;
    const variableCostPerService = costProfile.variableCostsPerService.averagePerService.amountCents;
    const averageTicket = operationMetrics.averageTicket.amountCents;
    const marginPerService = averageTicket - variableCostPerService;
    const breakEvenServices = marginPerService > 0 ? Math.ceil(fixedCosts / marginPerService) : 0;
    const breakEvenRevenue = breakEvenServices * averageTicket;
    const currentRevenue = operationMetrics.totalRevenue.amountCents;
    const marginToBreakEven = currentRevenue - breakEvenRevenue;
    const isAboveBreakEven = marginToBreakEven >= 0;
    return {
      breakEvenMonthlyServices: breakEvenServices,
      breakEvenMonthlyRevenue: { amountCents: breakEvenRevenue, currency: 'BRL' },
      currentMonthlyServices: operationMetrics.totalServices,
      currentMonthlyRevenue: { amountCents: currentRevenue, currency: 'BRL' },
      marginToBreakEven,
      isAboveBreakEven,
      calculatedAt: new Date().toISOString(),
      immutable: true,
    };
  }

  calculateServiceMarginAnalysis(
    storeId: string,
    serviceOfferingId: string,
    costProfile: OperationalCostProfile,
    period: { start: string; end: string }
  ): ServiceMarginAnalysis | null {
    const facadeAny = this.facade as any;
    const offering = facadeAny.serviceOfferings.get(serviceOfferingId);
    if (!offering || offering.storeId !== storeId) return null;

    const periodStart = new Date(period.start);
    const periodEnd = new Date(period.end);
    const serviceOrders = Array.from(facadeAny.serviceOrders.values())
      .filter((o: any) => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= periodStart && orderDate <= periodEnd && o.status === 'completed';
      })
      .filter((o: any) => o.offeringId === serviceOfferingId) as ServiceOrderLike[];

    if (serviceOrders.length === 0) return null;

    let totalRevenue = 0;
    for (const order of serviceOrders) {
      totalRevenue += order.price.amountCents;
    }
    const averagePrice = totalRevenue / serviceOrders.length;
    const variableCost = costProfile.variableCostsPerService.averagePerService.amountCents;
    const fixedCostPerService = costProfile.fixedCostsMonthly.totalCents.amountCents / Math.max(serviceOrders.length, 1);
    const averageCost = variableCost + fixedCostPerService;
    const marginPerService = averagePrice - averageCost;
    const marginPercentage = averagePrice > 0 ? (marginPerService / averagePrice) * 100 : 0;
    const isProfitable = marginPerService > 0;
    const totalCost = averageCost * serviceOrders.length;
    const offeringRecord = facadeAny.serviceOfferings.get(serviceOfferingId) as ServiceOfferingLike | undefined;
    const template = facadeAny.services.getServiceTemplates().templates.find((t: any) => t.templateId === offeringRecord?.templateId);
    const serviceName = template?.name ?? 'Serviço';

    return {
      serviceOfferingId,
      serviceName,
      averagePrice: { amountCents: averagePrice, currency: 'BRL' },
      averageCost: { amountCents: averageCost, currency: 'BRL' },
      marginPerService: { amountCents: marginPerService, currency: 'BRL' },
      marginPercentage,
      isProfitable,
      servicesExecutedCount: serviceOrders.length,
      totalRevenue: { amountCents: totalRevenue, currency: 'BRL' },
      totalCost: { amountCents: totalCost, currency: 'BRL' },
      calculatedAt: new Date().toISOString(),
      immutable: true,
    };
  }

  private calculateOperationalRisk(
    breakEven: BreakEvenAnalysis,
    operationMetrics: RealOperationMetrics,
    serviceMargins: ServiceMarginAnalysis[]
  ): { risk: OperationalRiskLevel; factors: string[] } {
    const factors: string[] = [];
    if (!breakEven.isAboveBreakEven) factors.push('Operando abaixo do ponto de equilíbrio');
    if (operationMetrics.cancellationRate > 0.3) {
      factors.push(`Taxa de cancelamento alta (${Math.round(operationMetrics.cancellationRate * 100)}%)`);
    }
    const unprofitableServices = serviceMargins.filter(m => !m.isProfitable).length;
    if (unprofitableServices > 0) factors.push(`${unprofitableServices} serviço(s) executado(s) no prejuízo`);
    const avgMargin = serviceMargins.length > 0
      ? serviceMargins.reduce((sum, m) => sum + m.marginPercentage, 0) / serviceMargins.length
      : 0;
    if (avgMargin < 10) factors.push(`Margem média baixa (${Math.round(avgMargin)}%)`);

    let risk: OperationalRiskLevel = 'low';
    if (factors.length >= 3 || !breakEven.isAboveBreakEven) risk = 'high';
    else if (factors.length >= 2 || operationMetrics.cancellationRate > 0.2) risk = 'medium';
    return { risk, factors };
  }

  generatePricingAssistanceReport(
    storeId: string,
    companyId: string,
    actorId: string,
    period: { start: string; end: string }
  ): PricingAssistanceReport {
    const existingReport = Array.from(this.pricingAssistanceReports.values())
      .find(r => r.storeId === storeId && r.period.start === period.start && r.period.end === period.end);
    if (existingReport) throw new Error('Relatório já existe para este período (imutável)');

    const costProfile = this.operationalCostProfiles.get(storeId);
    if (!costProfile) throw new Error('Perfil de custo operacional não encontrado. Configure os custos primeiro.');

    const operationMetrics = this.calculateRealOperationMetrics(storeId, companyId, period);
    const breakEvenAnalysis = this.calculateBreakEvenAnalysis(storeId, costProfile, operationMetrics);

    const facadeAny = this.facade as any;
    const serviceOfferingsList = Array.from(facadeAny.serviceOfferings.values()).filter((o: any) => o.storeId === storeId) as ServiceOfferingLike[];
    const serviceMargins: ServiceMarginAnalysis[] = [];
    for (const offering of serviceOfferingsList) {
      const margin = this.calculateServiceMarginAnalysis(storeId, offering.offering_id, costProfile, period);
      if (margin) serviceMargins.push(margin);
    }

    const totalRevenue = serviceMargins.reduce((sum, m) => sum + m.totalRevenue.amountCents, 0);
    const totalCost = serviceMargins.reduce((sum, m) => sum + m.totalCost.amountCents, 0);
    const margin = totalRevenue - totalCost;
    const marginPercentage = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;
    const { risk, factors } = this.calculateOperationalRisk(breakEvenAnalysis, operationMetrics, serviceMargins);

    const alerts: Array<{ type: 'operating_at_loss' | 'below_break_even' | 'high_cancellation_rate' | 'low_margin_services'; message: string; severity: 'info' | 'warning' | 'critical' }> = [];
    if (!breakEvenAnalysis.isAboveBreakEven) {
      alerts.push({
        type: 'below_break_even',
        message: `Receita atual (R$ ${(breakEvenAnalysis.currentMonthlyRevenue.amountCents / 100).toFixed(2)}) está abaixo do ponto de equilíbrio (R$ ${(breakEvenAnalysis.breakEvenMonthlyRevenue.amountCents / 100).toFixed(2)})`,
        severity: 'critical',
      });
    }
    if (operationMetrics.cancellationRate > 0.3) {
      alerts.push({
        type: 'high_cancellation_rate',
        message: `Taxa de cancelamento de ${Math.round(operationMetrics.cancellationRate * 100)}%`,
        severity: 'warning',
      });
    }
    const unprofitableServices = serviceMargins.filter(m => !m.isProfitable);
    if (unprofitableServices.length > 0) {
      alerts.push({
        type: 'low_margin_services',
        message: `${unprofitableServices.length} serviço(s) com margem negativa`,
        severity: 'warning',
      });
    }
    if (margin < 0) {
      alerts.push({
        type: 'operating_at_loss',
        message: 'Operação com margem negativa no período',
        severity: 'critical',
      });
    }

    const reportId = `pricing-report-${storeId}-${period.start}-${period.end}`;
    const report: PricingAssistanceReport = {
      reportId,
      storeId,
      companyId,
      actorId,
      period,
      costProfile,
      operationMetrics,
      breakEvenAnalysis,
      serviceMargins,
      averageMonthlyMargin: {
        totalRevenue: { amountCents: totalRevenue, currency: 'BRL' },
        totalCost: { amountCents: totalCost, currency: 'BRL' },
        margin: { amountCents: margin, currency: 'BRL' },
        marginPercentage,
      },
      operationalRisk: risk,
      riskFactors: factors,
      alerts,
      governance: {
        noPriceSuggestion: true,
        noCatalogModification: true,
        noMatchingInterference: true,
        privateOnly: true,
      },
      generatedAt: new Date().toISOString(),
      immutable: true,
    };

    this.pricingAssistanceReports.set(reportId, report);
    marketplaceLogger.init('Relatório de precificação assistida gerado', { reportId, storeId, companyId });
    return report;
  }

  getPricingAssistanceReport(reportId: string, actorId: string): PricingAssistanceReport | null {
    const report = this.pricingAssistanceReports.get(reportId);
    if (!report) return null;
    if (report.actorId !== actorId) throw new Error('Acesso negado: apenas o dono/gestor pode ver este relatório');
    return report;
  }

  listPricingAssistanceReports(filters: {
    storeId: string;
    actorId: string;
    starts_at?: string;
    ends_at?: string;
  }): PricingAssistanceReport[] {
    let reports = Array.from(this.pricingAssistanceReports.values())
      .filter(r => r.storeId === filters.storeId && r.actorId === filters.actorId);
    if (filters.starts_at) reports = reports.filter(r => r.period.start >= filters.starts_at!);
    if (filters.ends_at) reports = reports.filter(r => r.period.end <= filters.ends_at!);
    return reports.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }
}