// backend/src/modules/marketplace/application/services/commerce-operations-application.service.ts
// Application Service: operações comerciais (PDV, delivery, dropship, fluxo financeiro regional).

import type { OrdersApplicationService } from './orders-application.service';
import type { MarketplaceIndustryModule } from '../../domain/industry/marketplace-industry.service';
import type {
  Order,
  DeliveryOrder,
  PaymentPlan,
  RevenueSnapshot,
  RegionalFinancialFlow,
} from '@contracts/marketplace';

export interface ICommerceOperationsOrchestrator {
  getRevenueSnapshot(region: { country: string; state: string; city: string }, period: { year: number; month: number }): RevenueSnapshot | null;
  getRegionalFundByRegion(tenantId: string, region: { country: string; state: string; city: string }): Promise<unknown>;
}

export interface ICommerceOperationsApplicationDeps {
  ordersApplicationService: OrdersApplicationService;
  industryModule: MarketplaceIndustryModule;
  orchestrator: ICommerceOperationsOrchestrator;
}

export class CommerceOperationsApplicationService {
  constructor(private readonly deps: ICommerceOperationsApplicationDeps) {}

  // ---------- PDV (pedido físico, clientes loja) ----------

  async createPhysicalOrder(
    tenantId: string,
    input: {
      storeId: string;
      items: Array<{ productId: string; quantity: number }>;
      customer_id?: string;
    }
  ): Promise<Order> {
    return this.deps.ordersApplicationService.createPhysicalOrder(tenantId, input);
  }

  createStoreCustomer(input: {
    storeId: string;
    name?: string;
    phone?: string;
    linked_user_id?: string;
  }): {
    customer_id: string;
    storeId: string;
    name?: string;
    phone?: string;
    linked_user_id?: string;
    createdAt: string;
  } {
    return this.deps.ordersApplicationService.createStoreCustomer(input);
  }

  getStoreCustomer(customerId: string): {
    customer_id: string;
    storeId: string;
    name?: string;
    phone?: string;
    linked_user_id?: string;
    createdAt: string;
  } | null {
    return this.deps.ordersApplicationService.getStoreCustomer(customerId);
  }

  // ---------- Delivery ----------

  createDeliveryFromCheckout(checkoutId: string): DeliveryOrder[] {
    return this.deps.ordersApplicationService.createDeliveryFromCheckout(checkoutId);
  }

  getDelivery(deliveryId: string): DeliveryOrder | null {
    return this.deps.ordersApplicationService.getDelivery(deliveryId);
  }

  getDeliveriesByCheckout(checkoutId: string): DeliveryOrder[] {
    return this.deps.ordersApplicationService.getDeliveriesByCheckout(checkoutId);
  }

  createDeliveryFromHub(checkoutId: string, hubId: string, storeId: string): DeliveryOrder {
    return this.deps.industryModule.createDeliveryFromHub(checkoutId, hubId, storeId);
  }

  // ---------- Dropship / Payment plan com entrega hub ----------

  createPaymentPlanWithDropship(
    checkoutId: string,
    method: 'balance' | 'card' | 'invoice',
    dropshipItems: Array<{
      productId: string;
      industryId: string;
      hubId: string;
      storeId: string;
      quantity: number;
      unitPrice: number;
    }>
  ): PaymentPlan {
    return this.deps.industryModule.createPaymentPlanWithDropship(checkoutId, method, dropshipItems);
  }

  // ---------- Fluxo financeiro regional (transparência / payout) ----------

  async getRegionalFinancialFlow(
    tenantId: string,
    region: { country: string; state: string; city: string },
    period: { year: number; month: number }
  ): Promise<RegionalFinancialFlow> {
    const snapshot = this.deps.orchestrator.getRevenueSnapshot(region, period);
    if (!snapshot) {
      throw new Error('Snapshot de receita não encontrado para o período especificado');
    }

    await this.deps.orchestrator.getRegionalFundByRegion(tenantId, region);

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