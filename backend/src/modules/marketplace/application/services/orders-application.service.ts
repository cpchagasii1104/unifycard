// backend/src/modules/marketplace/application/services/orders-application.service.ts
// Application Service: orquestração do domínio Orders (delegação ao domain module).

import type { MarketplaceOrdersModule } from '../../domain/orders/marketplace-orders.service';
import type { Order, CheckoutIntent, PaymentPlan, DeliveryOrder } from '@contracts/marketplace';

export class OrdersApplicationService {
  constructor(private readonly ordersModule: MarketplaceOrdersModule) {}

  createOrder(storeId: string): Order {
    return this.ordersModule.createOrder(storeId);
  }

  async createPhysicalOrder(
    tenantId: string,
    input: {
      storeId: string;
      items: Array<{ productId: string; quantity: number }>;
      customer_id?: string;
    }
  ): Promise<Order> {
    return this.ordersModule.createPhysicalOrder(tenantId, input);
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
    return this.ordersModule.createStoreCustomer(input);
  }

  getStoreCustomer(customerId: string): {
    customer_id: string;
    storeId: string;
    name?: string;
    phone?: string;
    linked_user_id?: string;
    createdAt: string;
  } | null {
    return this.ordersModule.getStoreCustomer(customerId);
  }

  async addOrderItem(orderId: string, productId: string, quantity: number): Promise<Order> {
    return this.ordersModule.addOrderItem(orderId, productId, quantity);
  }

  getOrder(orderId: string): Order | null {
    return this.ordersModule.getOrder(orderId);
  }

  createCheckoutFromOrder(orderId: string, attributionId?: string): CheckoutIntent {
    return this.ordersModule.createCheckoutFromOrder(orderId, attributionId);
  }

  getCheckout(checkoutId: string): CheckoutIntent | null {
    return this.ordersModule.getCheckout(checkoutId);
  }

  /** TEMP compatibility layer (post-refactor). */
  listCheckouts(): CheckoutIntent[] {
    return this.ordersModule.listCheckouts();
  }

  /** TEMP compatibility layer (post-refactor). */
  getCheckoutOrderId(checkoutId: string): string | undefined {
    return this.ordersModule.getCheckoutOrderId(checkoutId);
  }

  /** TEMP compatibility layer (post-refactor): update order in-memory. */
  updateOrder(orderId: string, order: Order): void {
    this.ordersModule.getOrdersMap().set(orderId, order);
  }

  confirmCheckout(checkoutId: string): CheckoutIntent {
    return this.ordersModule.confirmCheckout(checkoutId);
  }

  createPaymentPlan(checkoutId: string, method: 'balance' | 'card' | 'invoice'): PaymentPlan {
    return this.ordersModule.createPaymentPlan(checkoutId, method);
  }

  getPaymentPlan(paymentPlanId: string): PaymentPlan | null {
    return this.ordersModule.getPaymentPlan(paymentPlanId);
  }

  getOrders(): {
    getPaymentPlan(paymentPlanId: string): PaymentPlan | null;
    setPaymentPlan(paymentPlanId: string, plan: PaymentPlan): void;
    setDelivery(deliveryId: string, delivery: DeliveryOrder): void;
  } {
    return this.ordersModule.getOrders();
  }

  async executePaymentPlan(
    tenantId: string,
    userId: string,
    paymentPlanId: string
  ): Promise<never> {
    return this.ordersModule.executePaymentPlan(tenantId, userId, paymentPlanId);
  }

  createDeliveryFromCheckout(checkoutId: string): DeliveryOrder[] {
    return this.ordersModule.createDeliveryFromCheckout(checkoutId);
  }

  getDelivery(deliveryId: string): DeliveryOrder | null {
    return this.ordersModule.getDelivery(deliveryId);
  }

  getDeliveriesByCheckout(checkoutId: string): DeliveryOrder[] {
    return this.ordersModule.getDeliveriesByCheckout(checkoutId);
  }

  associateAttributionToCheckout(checkoutId: string, attributionId: string): void {
    this.ordersModule.associateAttributionToCheckout(checkoutId, attributionId);
  }

  addServiceOrderToOrder(
    orderId: string,
    serviceOrderId: string
  ): {
    orderId: string;
    storeId: string;
    channel: 'online' | 'physical' | 'b2b';
    origin: 'marketplace' | 'store_pdv' | 'external';
    items: Array<{
      productId: string;
      name: string;
      price: { amountCents: number; currency: string };
      quantity: number;
      subtotal: number;
    }>;
    totalCents: number;
  } {
    return this.ordersModule.addServiceOrderToOrder(orderId, serviceOrderId);
  }

  getOrdersMap(): Map<string, Order> {
    return this.ordersModule.getOrdersMap();
  }

  getCheckoutByOrderId(orderId: string): CheckoutIntent | null {
    return this.ordersModule.getCheckoutByOrderId(orderId);
  }

  getPaymentPlanByCheckoutId(checkoutId: string): PaymentPlan | null {
    return this.ordersModule.getPaymentPlanByCheckoutId(checkoutId);
  }

  // ---------- Attribution & Sharing (checkout attribution) ----------

  private attributions: Map<string, {
    attribution_id: string;
    source: { type: 'user' | 'group' | 'page' | 'store'; id: string };
    intent: 'business' | 'recommendation' | 'entertainment';
    visibility: {
      scope: 'public' | 'group' | 'direct' | 'relationship_category';
      group_id?: string;
      target_ids?: string[];
      relationship_category?: 'business' | 'friend' | 'family' | 'entertainment';
    };
    commission?: { type: 'percentage' | 'fixed'; valueCents: number };
    createdAt: string;
  }> = new Map();

  private shares: Map<string, {
    share_id: string;
    attribution_id: string;
    share_url: string;
    content_type: 'product' | 'service' | 'store';
    content_id: string;
    createdAt: string;
  }> = new Map();

  createAttributionContext(input: {
    source: { type: 'user' | 'group' | 'page' | 'store'; id: string };
    intent: 'business' | 'recommendation' | 'entertainment';
    visibility: {
      scope: 'public' | 'group' | 'direct' | 'relationship_category';
      group_id?: string;
      target_ids?: string[];
      relationship_category?: 'business' | 'friend' | 'family' | 'entertainment';
    };
    commission?: { type: 'percentage' | 'fixed'; valueCents: number };
  }): {
    attribution_id: string;
    source: { type: 'user' | 'group' | 'page' | 'store'; id: string };
    intent: 'business' | 'recommendation' | 'entertainment';
    visibility: {
      scope: 'public' | 'group' | 'direct' | 'relationship_category';
      group_id?: string;
      target_ids?: string[];
      relationship_category?: 'business' | 'friend' | 'family' | 'entertainment';
    };
    commission?: { type: 'percentage' | 'fixed'; valueCents: number };
    createdAt: string;
  } {
    const attributionId = `attribution-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const attribution = {
      attribution_id: attributionId,
      source: input.source,
      intent: input.intent,
      visibility: input.visibility,
      commission: input.commission,
      createdAt: new Date().toISOString(),
    };
    this.attributions.set(attributionId, attribution);
    return attribution;
  }

  createShare(input: {
    content_type: 'product' | 'service' | 'store';
    content_id: string;
    attribution_context: {
      source: { type: 'user' | 'group' | 'page' | 'store'; id: string };
      intent: 'business' | 'recommendation' | 'entertainment';
      visibility: {
        scope: 'public' | 'group' | 'direct' | 'relationship_category';
        group_id?: string;
        target_ids?: string[];
        relationship_category?: 'business' | 'friend' | 'family' | 'entertainment';
      };
      commission?: { type: 'percentage' | 'fixed'; valueCents: number };
    };
  }): { share_id: string; attribution_id: string; share_url: string } {
    const attribution = this.createAttributionContext(input.attribution_context);
    const shareId = `share-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const shareUrl = `/marketplace/${input.content_type}/${input.content_id}?attribution=${attribution.attribution_id}`;
    const share = {
      share_id: shareId,
      attribution_id: attribution.attribution_id,
      share_url: shareUrl,
      content_type: input.content_type,
      content_id: input.content_id,
      createdAt: new Date().toISOString(),
    };
    this.shares.set(shareId, share);
    return { share_id: shareId, attribution_id: attribution.attribution_id, share_url: shareUrl };
  }

  getAttribution(attributionId: string): {
    attribution_id: string;
    source: { type: 'user' | 'group' | 'page' | 'store'; id: string };
    intent: 'business' | 'recommendation' | 'entertainment';
    visibility: {
      scope: 'public' | 'group' | 'direct' | 'relationship_category';
      group_id?: string;
      target_ids?: string[];
      relationship_category?: 'business' | 'friend' | 'family' | 'entertainment';
    };
    commission?: { type: 'percentage' | 'fixed'; valueCents: number };
    createdAt: string;
  } | null {
    return this.attributions.get(attributionId) || null;
  }
}