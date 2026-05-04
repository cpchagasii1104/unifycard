// backend/src/modules/marketplace/services/marketplace-orders.service.ts
// Agregador: pedidos, clientes loja, entregas, attribution e sharing.
// Estado vive nos domain/application; este agregador apenas delega.
//
/**
 * ⚠️ NÃO É SSOT DE LOGÍSTICA
 * `DeliveryOrder` aqui é contrato comercial / delegação; não é verdade de transporte canónica.
 * Ver `RFC_UNIFIED_LOGISTICS_MODEL.md` e `RFC_LEI_LOGISTICA_UNIFICARD.md`.
 */

import type { Order, CheckoutIntent, DeliveryOrder, PaymentPlan } from '@contracts/marketplace';
import type { OrdersApplicationService } from '../application/services/orders-application.service';
import type { CommerceOperationsApplicationService } from '../application/services/commerce-operations-application.service';

export class MarketplaceOrdersService {
  constructor(
    private readonly orders: OrdersApplicationService,
    private readonly commerce: CommerceOperationsApplicationService
  ) {}

  createOrder(storeId: string): Order {
    return this.orders.createOrder(storeId);
  }

  async createPhysicalOrder(
    tenantId: string,
    input: {
      storeId: string;
      items: Array<{ productId: string; quantity: number }>;
      customer_id?: string;
    }
  ): Promise<Order> {
    return this.commerce.createPhysicalOrder(tenantId, input);
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
    return this.commerce.createStoreCustomer(input);
  }

  getStoreCustomer(customerId: string): {
    customer_id: string;
    storeId: string;
    name?: string;
    phone?: string;
    linked_user_id?: string;
    createdAt: string;
  } | null {
    return this.commerce.getStoreCustomer(customerId);
  }

  async addOrderItem(orderId: string, productId: string, quantity: number): Promise<Order> {
    return this.orders.addOrderItem(orderId, productId, quantity);
  }

  getOrder(orderId: string): Order | null {
    return this.orders.getOrder(orderId);
  }

  getOrders(): {
    getPaymentPlan(paymentPlanId: string): PaymentPlan | null;
    setPaymentPlan(paymentPlanId: string, plan: PaymentPlan): void;
    setDelivery(deliveryId: string, delivery: DeliveryOrder): void;
  } {
    return this.orders.getOrders();
  }

  updateOrder(orderId: string, order: Order): void {
    this.orders.updateOrder(orderId, order);
  }

  createDeliveryFromCheckout(checkoutId: string): DeliveryOrder[] {
    // TODO: gerar UnifiedDemand (RFC_UNIFIED_LOGISTICS_MODEL)
    return this.commerce.createDeliveryFromCheckout(checkoutId);
  }

  getDelivery(deliveryId: string): DeliveryOrder | null {
    return this.commerce.getDelivery(deliveryId);
  }

  getDeliveriesByCheckout(checkoutId: string): DeliveryOrder[] {
    return this.commerce.getDeliveriesByCheckout(checkoutId);
  }

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
  }) {
    return this.orders.createAttributionContext(input);
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
    return this.orders.createShare(input);
  }

  getAttribution(attributionId: string) {
    return this.orders.getAttribution(attributionId);
  }
}