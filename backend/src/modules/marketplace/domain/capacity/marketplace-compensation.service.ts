// backend/src/modules/marketplace/domain/capacity/marketplace-compensation.service.ts
// Domínio de compensação de recursos: repasses após conclusão de serviços.
// Single source of truth para compensações; stores (Maps) ficam apenas aqui.

import type { MarketplaceService } from '../../marketplace.service';
import type {
  ResourceCompensation,
  ResourceCompensationHistory,
  CompanyCompensationReport,
  CompensationModel,
} from '@contracts/marketplace';
import { marketplaceLogger } from '../../marketplace.logger';

/** Forma mínima de ServiceOrder acessada via facade */
interface ServiceOrderLike {
  orderId: string;
  price: { amountCents: number; currency: string };
}

/** Forma mínima de Order acessada via facade */
interface OrderLike {
  orderId: string;
  storeId: string;
}

export class MarketplaceCompensationService {
  private resourceCompensations: Map<string, ResourceCompensation> = new Map(); // compensationId -> compensation

  constructor(private readonly facade: MarketplaceService) {}

  getCompensation(compensationId: string): ResourceCompensation | null {
    return this.resourceCompensations.get(compensationId) ?? null;
  }

  setCompensation(compensationId: string, compensation: ResourceCompensation): void {
    this.resourceCompensations.set(compensationId, compensation);
  }

  getResourceCompensationsMap(): Map<string, ResourceCompensation> {
    return this.resourceCompensations;
  }

  async processResourceCompensation(
    tenantId: string,
    serviceOrderId: string,
    serviceBookingId: string,
    completedResources: string[] // IDs dos recursos que executaram o serviço
  ): Promise<ResourceCompensation[]> {
    const facadeAny = this.facade as any;
    // Buscar ServiceOrder
    const serviceOrder = Array.from(facadeAny.serviceOrders.values()).find(
      (so: unknown) => (so as ServiceOrderLike).orderId === serviceOrderId
    ) as ServiceOrderLike | undefined;
    if (!serviceOrder) {
      throw new Error('ServiceOrder não encontrado');
    }

    // Buscar Order associado
    const order = facadeAny.ordersApplicationService.getOrder(serviceOrder.orderId) as OrderLike | undefined;
    if (!order) {
      throw new Error('Order não encontrado');
    }

    // Buscar PaymentPlan
    const checkout = facadeAny.ordersApplicationService.getCheckoutByOrderId(order.orderId);
    if (!checkout) {
      throw new Error('CheckoutIntent não encontrado');
    }

    const paymentPlan = facadeAny.ordersApplicationService.getPaymentPlanByCheckoutId(checkout.checkoutId);
    if (!paymentPlan || paymentPlan.status !== 'executed') {
      throw new Error('PaymentPlan não encontrado ou não executado');
    }

    // Valor do serviço (do ServiceOrder)
    const serviceValue = {
      amountCents: serviceOrder.price.amountCents,
      currency: serviceOrder.price.currency,
    };

    // Calcular compensação para cada recurso
    const compensations: ResourceCompensation[] = [];

    for (const resourceId of completedResources) {
      const compensation = this.facade.capacity.calculateResourceCompensation(
        resourceId,
        serviceOrderId,
        serviceBookingId,
        serviceValue
      );

      if (compensation.compensationAmount.amountCents > 0) {
        try {
          const ledgerEntryId = await this.facade.capacity.recordResourceCompensationLedger(
            tenantId,
            compensation,
            order.storeId,
            resourceId
          );
          compensation.ledgerEntryId = ledgerEntryId;
          compensation.status = 'pending';
          compensation.updatedAt = new Date().toISOString();
          this.resourceCompensations.set(compensation.compensationId, compensation);
        } catch (error: any) {
          marketplaceLogger.error('Erro ao registrar compensação no ledger', error);
        }
      }

      compensations.push(compensation);
    }

    return compensations;
  }

  markCompensationAsPaid(compensationId: string): ResourceCompensation | null {
    const compensation = this.resourceCompensations.get(compensationId);
    if (!compensation) return null;
    compensation.status = 'paid';
    compensation.paidAt = new Date().toISOString();
    compensation.updatedAt = new Date().toISOString();
    this.resourceCompensations.set(compensationId, compensation);
    marketplaceLogger.init('Compensação marcada como paga', { compensationId, resourceId: compensation.resourceId });
    return compensation;
  }

  getResourceCompensations(
    resourceId: string,
    options?: { starts_at?: string; ends_at?: string; status?: ResourceCompensation['status'] }
  ): ResourceCompensation[] {
    let compensations = Array.from(this.resourceCompensations.values()).filter(c => c.resourceId === resourceId);
    if (options?.starts_at != null) compensations = compensations.filter(c => c.createdAt >= options.starts_at!);
    if (options?.ends_at != null) compensations = compensations.filter(c => c.createdAt <= options.ends_at!);
    if (options?.status) compensations = compensations.filter(c => c.status === options.status);
    return compensations.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getCompanyCompensations(
    storeId: string,
    options?: { starts_at?: string; ends_at?: string; status?: ResourceCompensation['status'] }
  ): ResourceCompensation[] {
    const resources = this.facade.capacity.getServiceResourcesByStore(storeId);
    const resourceIds = resources.map(r => r.resourceId);
    let compensations = Array.from(this.resourceCompensations.values()).filter(c => resourceIds.includes(c.resourceId));
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

  generateCompanyCompensationReport(storeId: string, startDate: string, endDate: string): CompanyCompensationReport {
    const compensations = this.getCompanyCompensations(storeId, { starts_at: startDate, ends_at: endDate });
    const resources = this.facade.capacity.getServiceResourcesByStore(storeId);
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