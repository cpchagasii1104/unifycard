// backend/src/modules/marketplace/facades/marketplace-b2b.facade.ts
// Cluster 3 — B2B, subscription orchestrator adapter, getServiceOffering, createServiceOffering, getEconomicIdentity, payment due date.
// Commit 25: extraído da MarketplaceService para reduzir a facade principal.

import type { EconomicIdentity } from '@contracts/marketplace';
import type { ISubscriptionOrchestrator } from '../domain/subscriptions/marketplace-subscriptions.service';
import type { ServiceOffering } from '@contracts/marketplace';
import { economicIdentityService } from '../economic-identity.service';
import type { MarketplaceCatalogAggregatorService } from '../services/marketplace-catalog.service';
import type { MarketplaceServicesAggregatorService } from '../services/marketplace-services.service';
import type { MarketplaceOrdersService } from '../services/marketplace-orders.service';
import type { MarketplaceCheckoutService } from '../services/marketplace-checkout.service';
import type { MarketplacePaymentsService } from '../services/marketplace-payments.service';
import type { OfferingsApplicationService } from '../application/services/offerings-application.service';

export interface IMarketplaceB2BFacadeDeps {
  getCatalog(): MarketplaceCatalogAggregatorService;
  getStoreProducts(
    tenantId: string,
    storeId: string,
    categoryId?: string
  ): Promise<{ products: Array<{ productId: string; isEnabled?: boolean }> } | null>;
  getServices(): MarketplaceServicesAggregatorService;
  getOrders(): MarketplaceOrdersService;
  getCheckout(): MarketplaceCheckoutService;
  getPayments(): MarketplacePaymentsService;
  getOfferingsApplicationService(): OfferingsApplicationService;
}

export class MarketplaceB2BFacade {
  constructor(private readonly deps: IMarketplaceB2BFacadeDeps) {}

  getSubscriptionOrchestratorAdapter(): ISubscriptionOrchestrator {
    const d = this.deps;
    return {
      getStores: () => {
        const r = d.getCatalog().getStores();
        return { stores: r.stores.map((s) => ({ storeId: s.storeId })) };
      },
      getStoreProducts: (tenantId, storeId, _): Promise<{ products: Array<{ productId: string; isEnabled?: boolean }> } | null> =>
        d.getStoreProducts(tenantId, storeId),
      getStoreServiceOfferings: (storeId) => d.getServices().getStoreServiceOfferings(storeId),
      createOrder: (storeId) => d.getOrders().createOrder(storeId),
      addOrderItem: async (orderId, productId, quantity) => {
        await d.getOrders().addOrderItem(orderId, productId, quantity);
      },
      getOrder: (orderId) => d.getOrders().getOrder(orderId),
      createServiceBooking: (input: unknown) => {
        const r = d.getServices().createServiceBooking(input as { offeringId: string; user_id: string; date: string; time: string; quantity: number });
        return { booking_id: r.booking_id };
      },
      confirmServiceBooking: (bookingId) => {
        const r = d.getServices().confirmServiceBooking(bookingId);
        return { orderId: r.orderId };
      },
      addServiceOrderToOrder: (orderId, serviceOrderId) => {
        d.getServices().addServiceOrderToOrder(orderId, serviceOrderId);
      },
      createCheckoutFromOrder: (orderId, attributionId) => d.getCheckout().createCheckoutFromOrder(orderId, attributionId),
      confirmCheckout: (checkoutId) => {
        d.getCheckout().confirmCheckout(checkoutId);
      },
      createPaymentPlan: (checkoutId, method) => d.getCheckout().createPaymentPlan(checkoutId, method as 'balance' | 'card' | 'invoice'),
    };
  }

  getServiceOffering(offeringId: string): ServiceOffering | null {
    return this.deps.getServices().getServiceOffering(offeringId);
  }

  createServiceOffering(offering: {
    offering_id: string;
    storeId: string;
    templateId: string;
    price: { amountCents: number; currency: string };
    duration_minutes?: number;
    recurrence?: 'weekly' | 'monthly';
    isActive: boolean;
  }): void {
    this.deps.getOfferingsApplicationService().addServiceOffering(offering);
  }

  async getEconomicIdentity(tenantId: string, userId: string): Promise<EconomicIdentity | null> {
    return economicIdentityService.getEconomicIdentity(tenantId, userId);
  }

  calculatePaymentDueDate(paymentTerms: string, baseDate: string): string {
    return this.deps.getPayments().calculatePaymentDueDate(paymentTerms, baseDate);
  }
}