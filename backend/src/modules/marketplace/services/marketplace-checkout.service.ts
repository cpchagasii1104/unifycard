// backend/src/modules/marketplace/services/marketplace-checkout.service.ts
// Agregador: checkout, payment plan e execução de pagamento.
// Estado vive nos domain/application; este agregador apenas delega.

import type { CheckoutIntent, PaymentPlan, DeliveryOrder } from '@contracts/marketplace';
import type { OrdersApplicationService } from '../application/services/orders-application.service';
import type { CommerceOperationsApplicationService } from '../application/services/commerce-operations-application.service';

export class MarketplaceCheckoutService {
  constructor(
    private readonly orders: OrdersApplicationService,
    private readonly commerce: CommerceOperationsApplicationService
  ) {}

  listCheckouts(): CheckoutIntent[] {
    return this.orders.listCheckouts();
  }

  getCheckoutOrderId(checkoutId: string): string | undefined {
    return this.orders.getCheckoutOrderId(checkoutId);
  }

  createCheckoutFromOrder(orderId: string, attributionId?: string): CheckoutIntent {
    return this.orders.createCheckoutFromOrder(orderId, attributionId);
  }

  getCheckout(checkoutId: string): CheckoutIntent | null {
    return this.orders.getCheckout(checkoutId);
  }

  confirmCheckout(checkoutId: string): CheckoutIntent {
    return this.orders.confirmCheckout(checkoutId);
  }

  createPaymentPlan(checkoutId: string, method: 'balance' | 'card' | 'invoice'): PaymentPlan {
    return this.orders.createPaymentPlan(checkoutId, method);
  }

  getPaymentPlan(paymentPlanId: string): PaymentPlan | null {
    return this.orders.getPaymentPlan(paymentPlanId);
  }

  associateAttributionToCheckout(checkoutId: string, attributionId: string): void {
    this.orders.associateAttributionToCheckout(checkoutId, attributionId);
  }

  async executePaymentPlan(
    tenantId: string,
    userId: string,
    paymentPlanId: string
  ): Promise<never> {
    return this.orders.executePaymentPlan(tenantId, userId, paymentPlanId);
  }

  /** Dropship: payment plan com itens de múltiplos hubs (Commit 21 — migrado da facade). */
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
    return this.commerce.createPaymentPlanWithDropship(checkoutId, method, dropshipItems);
  }

  /** Entrega a partir de hub (Commit 21 — migrado da facade). */
  createDeliveryFromHub(checkoutId: string, hubId: string, storeId: string): DeliveryOrder {
    return this.commerce.createDeliveryFromHub(checkoutId, hubId, storeId);
  }
}