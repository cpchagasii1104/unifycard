import type {
  Subscription,
  SubscriptionCycle,
  Order,
  CheckoutIntent,
  PaymentPlan,
} from "@contracts/marketplace";
import { marketplaceLogger } from "../../marketplace.logger";

export interface ISubscriptionOrchestrator {
  // ===== Estrutural =====
  getStores(): { stores: Array<{ storeId: string }> };

  getStoreProducts(
    tenantId: string,
    storeId: string,
    _?: unknown
  ): Promise<{
    products: Array<{
      productId: string;
      isEnabled?: boolean;
    }>;
  } | null>;

  getStoreServiceOfferings(storeId: string): {
    offerings: Array<{
      offering_id: string;
      isActive: boolean;
    }>;
  };

  // ===== Order =====
  createOrder(storeId: string): { orderId: string };

  addOrderItem(orderId: string, productId: string, quantity: number): Promise<void>;

  getOrder(orderId: string): unknown;

  // ===== Service Booking =====
  createServiceBooking(...args: unknown[]): { booking_id: string };

  confirmServiceBooking(bookingId: string): { orderId: string };

  addServiceOrderToOrder(orderId: string, serviceOrderId: string): void;

  // ===== Checkout (SYNC) =====
  createCheckoutFromOrder(orderId: string, attributionId?: string): { checkoutId: string };

  confirmCheckout(checkoutId: string): void;

  createPaymentPlan(checkoutId: string, method: string): unknown;
}

export class MarketplaceSubscriptionsService {
  private subscriptions: Map<string, Subscription> = new Map();
  private subscriptionCycles: Map<string, SubscriptionCycle[]> = new Map();

  constructor(private readonly orchestrator: ISubscriptionOrchestrator) {}

  /**
   * Criar nova assinatura
   */
  async createSubscription(
    tenantId: string,
    input: {
      type: "product" | "service" | "mixed";
      billingCycle: "weekly" | "monthly" | "yearly";
      starts_at: string;
      linked_entities: {
        products?: Array<{ productId: string; storeId: string; quantity: number }>;
        service_offerings?: Array<{ offering_id: string; storeId: string; quantity: number }>;
      };
      customer_id: string;
      storeId: string;
      payment_method: "balance" | "card" | "invoice";
      attribution_id?: string;
    }
  ): Promise<Subscription> {
    const storesData = this.orchestrator.getStores();
    const store = storesData.stores.find((s) => s.storeId === input.storeId);
    if (!store) {
      throw new Error("Loja não encontrada");
    }

    if (input.linked_entities.products) {
      for (const productLink of input.linked_entities.products) {
        const storeProducts = await this.orchestrator.getStoreProducts(
          tenantId,
          productLink.storeId,
          undefined
        );
        const product = storeProducts?.products.find((p) => p.productId === productLink.productId);
        if (!product || !product.isEnabled) {
          throw new Error(`Produto ${productLink.productId} não encontrado ou inativo`);
        }
      }
    }

    if (input.linked_entities.service_offerings) {
      for (const serviceLink of input.linked_entities.service_offerings) {
        const offerings = this.orchestrator.getStoreServiceOfferings(serviceLink.storeId);
        const offering = offerings.offerings.find((o) => o.offering_id === serviceLink.offering_id);
        if (!offering || !offering.isActive) {
          throw new Error(`Serviço ${serviceLink.offering_id} não encontrado ou inativo`);
        }
      }
    }

    const subscriptionId = `subscription-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const subscription: Subscription = {
      subscriptionId,
      type: input.type,
      billingCycle: input.billingCycle,
      startDate: input.starts_at,
      status: "active",
      linkedEntities: {
        products: input.linked_entities.products?.map((p) => ({
          productId: p.productId,
          storeId: p.storeId,
          quantity: p.quantity,
        })),
        serviceOfferings: input.linked_entities.service_offerings?.map((s) => ({
          offeringId: s.offering_id,
          storeId: s.storeId,
          quantity: s.quantity,
        })),
      },
      customerId: input.customer_id,
      storeId: input.storeId,
      paymentMethod: input.payment_method,
      attributionId: input.attribution_id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.subscriptions.set(subscriptionId, subscription);
    this.subscriptionCycles.set(subscriptionId, []);

    marketplaceLogger.init("Subscription criada", { subscription_id: subscriptionId });

    return subscription;
  }

  getSubscription(subscriptionId: string): Subscription | null {
    return this.subscriptions.get(subscriptionId) ?? null;
  }

  getCustomerSubscriptions(customerId: string): Subscription[] {
    return Array.from(this.subscriptions.values()).filter((s) => s.customerId === customerId);
  }

  getStoreSubscriptions(storeId: string): Subscription[] {
    return Array.from(this.subscriptions.values()).filter((s) => s.storeId === storeId);
  }

  getSubscriptionCycles(subscriptionId: string): SubscriptionCycle[] {
    return this.subscriptionCycles.get(subscriptionId) ?? [];
  }

  getSubscriptionCycle(cycleId: string): SubscriptionCycle | null {
    for (const cycles of this.subscriptionCycles.values()) {
      const cycle = cycles.find((c) => c.cycleId === cycleId);
      if (cycle) return cycle;
    }
    return null;
  }

  /**
   * Pausar assinatura (não retroativo)
   */
  pauseSubscription(subscriptionId: string): Subscription {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error("Assinatura não encontrada");
    }

    if (subscription.status !== "active") {
      throw new Error(`Assinatura não pode ser pausada. Status atual: ${subscription.status}`);
    }

    subscription.status = "paused";
    subscription.updatedAt = new Date().toISOString();

    marketplaceLogger.init("Subscription pausada", { subscription_id: subscriptionId });

    return subscription;
  }

  /**
   * Retomar assinatura pausada
   */
  resumeSubscription(subscriptionId: string): Subscription {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error("Assinatura não encontrada");
    }

    if (subscription.status !== "paused") {
      throw new Error(`Assinatura não pode ser retomada. Status atual: ${subscription.status}`);
    }

    subscription.status = "active";
    subscription.updatedAt = new Date().toISOString();

    marketplaceLogger.init("Subscription retomada", { subscription_id: subscriptionId });

    return subscription;
  }

  /**
   * Cancelar assinatura (não retroativo, apenas ciclos futuros)
   */
  cancelSubscription(subscriptionId: string): Subscription {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error("Assinatura não encontrada");
    }

    if (subscription.status === "cancelled") {
      throw new Error("Assinatura já está cancelada");
    }

    subscription.status = "cancelled";
    subscription.cancelledAt = new Date().toISOString();
    subscription.updatedAt = new Date().toISOString();

    marketplaceLogger.init("Subscription cancelada", { subscription_id: subscriptionId });

    return subscription;
  }

  /**
   * Gerar ciclo de cobrança para uma assinatura
   * Cria Order → Checkout → PaymentPlan (reutiliza lógica existente)
   */
  async generateSubscriptionCycle(
    tenantId: string,
    userId: string,
    subscriptionId: string
  ): Promise<{
    cycle: SubscriptionCycle;
    order: Order;
    checkout: CheckoutIntent;
    paymentPlan: PaymentPlan;
  }> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error("Assinatura não encontrada");
    }

    if (subscription.status !== "active") {
      throw new Error(`Assinatura não está ativa. Status: ${subscription.status}`);
    }

    const startDate = new Date(subscription.startDate);
    const cycles = this.subscriptionCycles.get(subscriptionId) ?? [];
    const cycleNumber = cycles.length + 1;

    let cycleStartDate: Date;
    let cycleEndDate: Date;

    if (subscription.billingCycle === "weekly") {
      cycleStartDate = new Date(startDate);
      cycleStartDate.setDate(startDate.getDate() + (cycleNumber - 1) * 7);
      cycleEndDate = new Date(cycleStartDate);
      cycleEndDate.setDate(cycleStartDate.getDate() + 7);
    } else if (subscription.billingCycle === "monthly") {
      cycleStartDate = new Date(startDate);
      cycleStartDate.setMonth(startDate.getMonth() + (cycleNumber - 1));
      cycleEndDate = new Date(cycleStartDate);
      cycleEndDate.setMonth(cycleStartDate.getMonth() + 1);
    } else {
      cycleStartDate = new Date(startDate);
      cycleStartDate.setFullYear(startDate.getFullYear() + (cycleNumber - 1));
      cycleEndDate = new Date(cycleStartDate);
      cycleEndDate.setFullYear(cycleStartDate.getFullYear() + 1);
    }

    const existingCycle = cycles.find(
      (c) => c.startDate === cycleStartDate.toISOString().split("T")[0]
    );
    if (existingCycle) {
      throw new Error("Ciclo já foi gerado para este período");
    }

    const order = this.orchestrator.createOrder(subscription.storeId) as Order;

    if (subscription.linkedEntities.products) {
      for (const productLink of subscription.linkedEntities.products) {
        for (let i = 0; i < productLink.quantity; i++) {
          await this.orchestrator.addOrderItem(order.orderId, productLink.productId, 1);
        }
      }
    }

    if (subscription.linkedEntities.serviceOfferings) {
      for (const serviceLink of subscription.linkedEntities.serviceOfferings) {
        const booking = this.orchestrator.createServiceBooking({
          offeringId: serviceLink.offeringId,
          user_id: userId,
          date: cycleStartDate.toISOString().split("T")[0],
          time: "09:00",
          quantity: serviceLink.quantity,
        });

        const serviceOrderResult = this.orchestrator.confirmServiceBooking(booking.booking_id);

        this.orchestrator.addServiceOrderToOrder(order.orderId, serviceOrderResult.orderId);

        const updatedOrder = this.orchestrator.getOrder(order.orderId);
        if (updatedOrder && typeof updatedOrder === "object") {
          Object.assign(order, updatedOrder);
        }
      }
    }

    const checkout = this.orchestrator.createCheckoutFromOrder(
      order.orderId,
      subscription.attributionId
    ) as CheckoutIntent;

    this.orchestrator.confirmCheckout(checkout.checkoutId);

    const paymentPlan = this.orchestrator.createPaymentPlan(
      checkout.checkoutId,
      subscription.paymentMethod
    ) as PaymentPlan;

    if (subscription.paymentMethod === "invoice") {
      const invoiceIssuedAt = new Date().toISOString();
      const invoiceDueDate = new Date(cycleEndDate);
      invoiceDueDate.setDate(invoiceDueDate.getDate() + 30);
      (paymentPlan as unknown as Record<string, unknown>).issuedAt = invoiceIssuedAt;
      (paymentPlan as unknown as Record<string, unknown>).dueDate =
        invoiceDueDate.toISOString().split("T")[0];
    }

    const cycleId = `cycle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const cycle: SubscriptionCycle = {
      cycleId,
      subscriptionId,
      cycleNumber,
      startDate: cycleStartDate.toISOString().split("T")[0],
      endDate: cycleEndDate.toISOString().split("T")[0],
      status: "billed",
      orderId: order.orderId,
      checkoutId: checkout.checkoutId,
      paymentPlanId: paymentPlan.paymentPlanId,
      invoiceIssuedAt:
        subscription.paymentMethod === "invoice" ? new Date().toISOString() : undefined,
      invoiceDueDate:
        subscription.paymentMethod === "invoice"
          ? new Date(
              cycleEndDate.getTime() + 30 * 24 * 60 * 60 * 1000
            ).toISOString().split("T")[0]
          : undefined,
      createdAt: new Date().toISOString(),
    };

    cycles.push(cycle);
    this.subscriptionCycles.set(subscriptionId, cycles);

    marketplaceLogger.init("Subscription cycle gerado", {
      subscription_id: subscriptionId,
      cycle_id: cycleId,
      cycle_number: cycleNumber,
    });

    return {
      cycle,
      order,
      checkout,
      paymentPlan,
    };
  }
}
