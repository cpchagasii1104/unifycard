// backend/src/modules/marketplace/marketplace-orders.service.ts
// Módulo de orders e pagamentos (estado e lógica extraídos da facade).
//
// NORMATIVO (marketplace persistido): pedidos que representam compromisso de estoque ou
// liquidação devem usar `order.service` + rotas HTTP `/marketplace/orders` (SSOT em `orders`).
// Este módulo mantém Maps em memória para fluxos legados da facade/contratos declarativos;
// não usar como fonte de verdade operacional nem para PDV/checkout persistido.
//
/**
 * ⚠️ NÃO É SSOT DE LOGÍSTICA
 * `DeliveryOrder` neste módulo representa compromisso comercial / pedido de entrega em fluxos legados.
 * NÃO define como o transporte físico ocorre nem substitui planeamento logístico.
 *
 * Movimento físico canónico (evolução): `UnifiedDemand` + `TransportPlan` — ver
 * `docs/02_decisions/RFC_UNIFIED_LOGISTICS_MODEL.md` e `RFC_LEI_LOGISTICA_UNIFICARD.md`.
 */

import type { MarketplaceService } from '../../marketplace.service';
import type { Order, CheckoutIntent, PaymentPlan, DeliveryOrder } from '@contracts/marketplace';
import { marketplaceLogger } from '../../marketplace.logger';
import type { IMarketplaceStateReader } from '../../state/marketplace-state.adapter';

export class MarketplaceOrdersModule {
  /**
   * Pedidos do Marketplace (in-memory, temporários)
   * Armazena pedidos em memória sem persistência. Formato conforme Order.contract (camelCase).
   */
  private orders: Map<string, Order> = new Map();

  /**
   * Clientes da Loja (in-memory)
   */
  private storeCustomers: Map<string, {
    customer_id: string;
    storeId: string;
    name?: string;
    phone?: string;
    linked_user_id?: string;
    createdAt: string;
  }> = new Map();

  /**
   * CheckoutIntent do Marketplace (formato contrato: camelCase).
   * DECLARATIVO - NÃO executa pagamento, NÃO move dinheiro
   */
  private checkouts: Map<string, CheckoutIntent> = new Map();
  /** Mapa checkoutId → orderId (checkout criado a partir de um Order; contrato não expõe orderId em orders[]) */
  private checkoutOrderIds: Map<string, string> = new Map();

  /**
   * Payment Orchestrator - PaymentPlan (formato contrato: camelCase).
   * DECLARATIVO - NÃO executa pagamento, NÃO move dinheiro
   */
  private paymentPlans: Map<string, PaymentPlan> = new Map();
  /** Mapa paymentPlanId → attributionId (contrato PaymentPlan não expõe attribution) */
  private paymentPlanAttributionIds: Map<string, string> = new Map();

  /**
   * Sistema de Logística - DeliveryOrder
   * Permite entrega própria ou por terceiros
   * DECLARATIVO - NÃO calcula rota, NÃO otimiza, NÃO integra mapas
   */
  private deliveries: Map<string, DeliveryOrder> = new Map();

  constructor(
    private readonly facade: MarketplaceService,
    private readonly state?: IMarketplaceStateReader
  ) {}

  // ---------- Acesso para a facade (outros métodos que leem esses Maps) ----------
  getOrdersMap(): Map<string, Order> {
    return this.orders;
  }

  getCheckoutByOrderId(orderId: string): CheckoutIntent | null {
    return Array.from(this.checkouts.values())
      .find(c => this.checkoutOrderIds.get(c.checkoutId) === orderId) ?? null;
  }

  /** TEMP compatibility layer (post-refactor): list all checkouts. */
  listCheckouts(): CheckoutIntent[] {
    return Array.from(this.checkouts.values());
  }

  /** TEMP compatibility layer (post-refactor): get orderId for a checkout. */
  getCheckoutOrderId(checkoutId: string): string | undefined {
    return this.checkoutOrderIds.get(checkoutId);
  }

  getPaymentPlanByCheckoutId(checkoutId: string): PaymentPlan | null {
    return Array.from(this.paymentPlans.values()).find(pp => pp.checkoutId === checkoutId) ?? null;
  }

  // ---------- Orders ----------

  /**
   * Criar novo pedido vazio (online). Retorna Order conforme contrato (camelCase).
   */
  createOrder(storeId: string): Order {
    const storesData = this.facade.catalog.getStores();
    const store = storesData.stores.find(s => s.storeId === storeId);

    if (!store) {
      throw new Error('Loja não encontrada');
    }

    const orderId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const order: Order = {
      orderId,
      storeId,
      channel: 'online',
      origin: 'marketplace',
      items: [],
      totalCents: 0,
    };

    this.orders.set(orderId, order);

    return order;
  }

  /**
   * Criar pedido físico (PDV). Retorna Order conforme contrato (camelCase).
   * Não exige checkout público, não exige attribution
   */
  async createPhysicalOrder(tenantId: string, input: {
    storeId: string;
    items: Array<{
      productId: string;
      quantity: number;
    }>;
    customer_id?: string;
  }): Promise<Order> {
    const storesData = this.facade.catalog.getStores();
    const store = storesData.stores.find(s => s.storeId === input.storeId);

    if (!store) {
      throw new Error('Loja não encontrada');
    }

    const orderId = `pdv-order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const storeProducts = await this.facade.getStoreProducts(tenantId, input.storeId);

    if (!storeProducts) {
      throw new Error('Loja não encontrada');
    }

    const items: Order['items'] = [];

    for (const inputItem of input.items) {
      const product = storeProducts.products.find(p => p.productId === inputItem.productId);

      if (!product) {
        throw new Error(`Produto ${inputItem.productId} não encontrado nesta loja`);
      }

      if (!product.isEnabled) {
        throw new Error(`Produto ${product.name} não está ativado`);
      }

      if (!product.price) {
        throw new Error(`Produto ${product.name} não possui preço definido`);
      }

      if (inputItem.quantity < 1) {
        throw new Error('Quantidade deve ser maior que zero');
      }

      const isIndustrial = product.isIndustrial || product.industryId;

      if (!isIndustrial) {
        if (!product.stock || product.stock.quantity < inputItem.quantity) {
          throw new Error(`Estoque insuficiente para ${product.name}. Disponível: ${product.stock?.quantity || 0}, solicitado: ${inputItem.quantity}`);
        }

        if (product.stock) {
          product.stock.quantity -= inputItem.quantity;
        }
      }

      const amountCents = 'amountCents' in product.price ? product.price.amountCents : Math.round((product.price as { amount: number; currency: string }).amount * 100);
      const subtotal = amountCents * inputItem.quantity;

      items.push({
        productId: product.productId,
        name: product.name,
        price: { amountCents, currency: product.price.currency },
        quantity: inputItem.quantity,
        subtotal,
      });
    }

    const totalCents = items.reduce((sum, item) => sum + item.subtotal, 0);

    const order: Order = {
      orderId,
      storeId: input.storeId,
      channel: 'physical',
      origin: 'store_pdv',
      customerId: input.customer_id,
      items,
      totalCents,
    };
    (order as any).tenantId = tenantId;
    this.orders.set(orderId, order);

    return order;
  }

  /**
   * Criar ou buscar cliente da loja
   */
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
    let existingCustomer = Array.from(this.storeCustomers.values()).find(
      c => c.storeId === input.storeId && (
        (input.phone && c.phone === input.phone) ||
        (input.linked_user_id && c.linked_user_id === input.linked_user_id)
      )
    );

    if (existingCustomer) {
      if (input.name) existingCustomer.name = input.name;
      if (input.phone) existingCustomer.phone = input.phone;
      if (input.linked_user_id) existingCustomer.linked_user_id = input.linked_user_id;
      this.storeCustomers.set(existingCustomer.customer_id, existingCustomer);
      return existingCustomer;
    }

    const customerId = `customer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const customer = {
      customer_id: customerId,
      storeId: input.storeId,
      name: input.name,
      phone: input.phone,
      linked_user_id: input.linked_user_id,
      createdAt: new Date().toISOString(),
    };

    this.storeCustomers.set(customerId, customer);
    return customer;
  }

  /**
   * Buscar cliente da loja
   */
  getStoreCustomer(customerId: string): {
    customer_id: string;
    storeId: string;
    name?: string;
    phone?: string;
    linked_user_id?: string;
    createdAt: string;
  } | null {
    return this.storeCustomers.get(customerId) || null;
  }

  /**
   * Adicionar item ao pedido
   */
  async addOrderItem(orderId: string, productId: string, quantity: number): Promise<Order> {
    const order = this.orders.get(orderId);

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    const tenantId = (order as any).tenantId as string | undefined;
    if (!tenantId) {
      throw new Error('Pedido sem tenantId; use createPhysicalOrder(tenantId, input) para criar pedidos');
    }

    if (quantity < 1) {
      throw new Error('Quantidade deve ser maior que zero');
    }

    const storeProducts = await this.facade.getStoreProducts(tenantId, order.storeId);

    if (!storeProducts) {
      throw new Error('Loja não encontrada');
    }

    const product = storeProducts.products.find(p => p.productId === productId);

    if (!product) {
      throw new Error('Produto não encontrado nesta loja');
    }

    if (!product.isEnabled) {
      throw new Error('Produto não está ativado');
    }

    if (!product.price) {
      throw new Error('Produto não possui preço definido');
    }

    const isIndustrial = product.isIndustrial || product.industryId;

    if (!isIndustrial) {
      if (!product.stock || product.stock.quantity === 0) {
        throw new Error('Produto indisponível (estoque zero)');
      }

      if (product.stock.quantity < quantity) {
        throw new Error(`Estoque insuficiente. Disponível: ${product.stock.quantity}`);
      }
    }

    const amountCents = 'amountCents' in product.price ? product.price.amountCents : Math.round((product.price as { amount: number; currency: string }).amount * 100);

    const existingItemIndex = order.items.findIndex(item => item.productId === productId);

    if (existingItemIndex >= 0) {
      const existingItem = order.items[existingItemIndex];
      const newQuantity = existingItem.quantity + quantity;

      if (!isIndustrial && product.stock && product.stock.quantity < newQuantity) {
        throw new Error(`Estoque insuficiente. Disponível: ${product.stock.quantity}, solicitado: ${newQuantity}`);
      }

      existingItem.quantity = newQuantity;
      existingItem.subtotal = existingItem.price.amountCents * existingItem.quantity;
    } else {
      const subtotal = amountCents * quantity;

      order.items.push({
        productId,
        name: product.name,
        price: { amountCents, currency: product.price.currency },
        quantity,
        subtotal,
      });
    }

    order.totalCents = order.items.reduce((sum, item) => sum + item.subtotal, 0);

    return order;
  }

  /**
   * Buscar pedido por ID
   */
  getOrder(orderId: string): Order | null {
    return this.orders.get(orderId) || null;
  }

  // ---------- Checkout ----------

  /**
   * Criar CheckoutIntent a partir de um Order
   */
  createCheckoutFromOrder(orderId: string, attributionId?: string): CheckoutIntent {
    const order = this.getOrder(orderId);

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    if (order.items.length === 0) {
      throw new Error('Pedido vazio não pode ser convertido em checkout');
    }

    const checkoutId = `checkout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const storeGroups = new Map<string, Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>>();

    order.items.forEach(item => {
      const storeId = order.storeId;
      if (!storeGroups.has(storeId)) {
        storeGroups.set(storeId, []);
      }
      storeGroups.get(storeId)!.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.price.amountCents,
        subtotal: item.subtotal,
      });
    });

    const orders: CheckoutIntent['orders'] = Array.from(storeGroups.entries()).map(([storeId, items]) => {
      const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      return { storeId, items, subtotal };
    });

    const totalCents = orders.reduce((sum, o) => sum + o.subtotal, 0);

    const checkout: CheckoutIntent = {
      checkoutId,
      orders,
      totalCents,
      paymentOptions: {
        allowBalance: true,
        allowCard: true,
        allowInvoice: true,
      },
      status: 'open',
      ...(attributionId !== undefined && { attributionId }),
    };

    this.checkouts.set(checkoutId, checkout);
    this.checkoutOrderIds.set(checkoutId, orderId);

    return checkout;
  }

  /**
   * Buscar CheckoutIntent por ID
   */
  getCheckout(checkoutId: string): CheckoutIntent | null {
    return this.checkouts.get(checkoutId) || null;
  }

  /**
   * Confirmar CheckoutIntent
   */
  confirmCheckout(checkoutId: string): CheckoutIntent {
    const checkout = this.checkouts.get(checkoutId);

    if (!checkout) {
      throw new Error('Checkout não encontrado');
    }

    if (checkout.status === 'confirmed') {
      throw new Error('Checkout já foi confirmado');
    }

    checkout.status = 'confirmed';

    return checkout;
  }

  /**
   * Associar attribution_id ao checkout (se vier de share)
   */
  associateAttributionToCheckout(checkoutId: string, attributionId: string): void {
    const checkout = this.checkouts.get(checkoutId);
    if (checkout) {
      (checkout as any).attribution_id = attributionId;
      this.checkouts.set(checkoutId, checkout);
    }
  }

  // ---------- PaymentPlan ----------

  /**
   * Criar PaymentPlan a partir de CheckoutIntent
   */
  createPaymentPlan(checkoutId: string, method: 'balance' | 'card' | 'invoice'): PaymentPlan {
    const checkout = this.getCheckout(checkoutId);

    if (!checkout) {
      throw new Error('Checkout não encontrado');
    }

    if (checkout.status !== 'confirmed') {
      throw new Error('Checkout precisa estar confirmado para criar payment plan');
    }

    if (method === 'invoice') {
      for (const order of checkout.orders) {
        this.facade.applyTrustGuards({
          actorId: order.storeId,
          action: 'invoice',
          amountCents: order.subtotal,
        });
      }
    }

    if (method === 'balance' && !checkout.paymentOptions.allowBalance) {
      throw new Error('Método de pagamento "balance" não permitido');
    }
    if (method === 'card' && !checkout.paymentOptions.allowCard) {
      throw new Error('Método de pagamento "card" não permitido');
    }
    if (method === 'invoice' && !checkout.paymentOptions.allowInvoice) {
      throw new Error('Método de pagamento "invoice" não permitido');
    }

    const paymentPlanId = `payment-plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const attributionId = checkout.attributionId;
    let attribution = null;
    if (attributionId) {
      attribution = this.facade.orders.getAttribution(attributionId);
    }

    const paymentPlan: PaymentPlan = {
      paymentPlanId,
      checkoutId,
      method,
      totalCents: checkout.totalCents,
      splits: [],
      status: 'calculated',
    };

    this.paymentPlans.set(paymentPlanId, paymentPlan);
    if (attributionId) {
      this.paymentPlanAttributionIds.set(paymentPlanId, attributionId);
    }

    let isServiceCheckout = false;
    let serviceRequestId: string | null = null;

    const orderIdForCheckout = this.checkoutOrderIds.get(checkoutId);
    const serviceOrders = this.state?.serviceOrders ?? this.facade.services.getServiceOrdersMap();
    const serviceBookings = this.state?.serviceBookings ?? this.facade.services.getServiceBookingsMap();

    for (const checkoutOrder of checkout.orders) {
      const order = orderIdForCheckout ? this.orders.get(orderIdForCheckout) : null;
      if (order) {
        const serviceOrder = Array.from(serviceOrders.values())
          .find(so => so.orderId === order.orderId);

        if (serviceOrder) {
          isServiceCheckout = true;
          const booking = serviceBookings.get(serviceOrder.bookingId);
          if (booking) {
            const dispatchesMap = this.state?.serviceDispatches ?? this.facade.dispatch.getServiceDispatchesMap();
            const dispatch = Array.from(dispatchesMap.values())
              .find(d => {
                const preReservations = this.facade.dispatch.getPreReservationsByDispatch(d.dispatchId);
                return preReservations.some((pr: { offeringId: string; date: string; time: string }) =>
                  pr.offeringId === serviceOrder.offeringId &&
                  pr.date === booking.date &&
                  pr.time === booking.time
                );
              });
            if (dispatch) {
              serviceRequestId = dispatch.requestId;
            }
          }
          break;
        }
      }
    }

    if (isServiceCheckout && serviceRequestId) {
      const hold = this.facade.payments.createServicePaymentHold(
        serviceRequestId,
        paymentPlanId,
        checkout.totalCents,
        'BRL',
        'client_confirm',
        24
      );

      marketplaceLogger.init('Payment hold criado para serviço', {
        hold_id: hold.holdId,
        requestId: serviceRequestId,
        paymentPlanId: paymentPlanId,
      });
    }

    return paymentPlan;
  }

  /**
   * Buscar PaymentPlan por ID
   */
  getPaymentPlan(paymentPlanId: string): PaymentPlan | null {
    return this.paymentPlans.get(paymentPlanId) || null;
  }

  /**
   * Adapter for legacy modules (SLA / Industry).
   */
  getOrders(): {
    getPaymentPlan(paymentPlanId: string): PaymentPlan | null;
    setPaymentPlan(paymentPlanId: string, plan: PaymentPlan): void;
    setDelivery(deliveryId: string, delivery: DeliveryOrder): void;
  } {
    return {
      getPaymentPlan: (id) => this.getPaymentPlan(id),
      setPaymentPlan: (id, plan) => this.paymentPlans.set(id, plan),
      setDelivery: (id, d) => this.deliveries.set(id, d),
    };
  }

  /**
   * Executar PaymentPlan (legacy path disabled).
   * Quando reativado com escrita no Bank: após commit, disparar reconciliação com referência explícita
   * (ex.: `bank_transaction` + id da transação ou `payment_plan` + paymentPlanId), via `enqueueReconciliation`.
   * Hoje: gatilho equivalente para `reference_type = payment_plan` está em `bankTransactionService.transfer` após sucesso.
   */
  async executePaymentPlan(
    _tenantId: string,
    _userId: string,
    _paymentPlanId: string
  ): Promise<never> {
    throw new Error(
      'LEGACY_FINANCIAL_PATH_DISABLED: MarketplaceService.executePaymentPlan() - Financial decision outside Bank is forbidden'
    );
  }

  // ---------- Delivery ----------

  /**
   * Criar DeliveryOrder a partir de Checkout
   */
  createDeliveryFromCheckout(checkoutId: string): DeliveryOrder[] {
    // TODO: gerar UnifiedDemand (RFC_UNIFIED_LOGISTICS_MODEL)
    const checkout = this.checkouts.get(checkoutId);

    if (!checkout) {
      throw new Error('Checkout não encontrado');
    }

    if (!(checkout as any).paid && !(checkout as any).invoiced) {
      throw new Error('Checkout precisa estar pago para criar entrega');
    }

    const storeDeliveryPreferences: Record<string, {
      type: 'own' | 'third_party';
      vehicles: Array<'bike' | 'moto' | 'car' | 'van'>;
      defaultVehicle: 'bike' | 'moto' | 'car' | 'van';
      costPayer: 'seller' | 'buyer' | 'platform';
      baseCost: number;
      etaMinutes: number;
    }> = {
      'store-001': {
        type: 'own',
        vehicles: ['bike', 'moto'],
        defaultVehicle: 'bike',
        costPayer: 'buyer',
        baseCost: 5.00,
        etaMinutes: 30,
      },
      'store-002': {
        type: 'third_party',
        vehicles: ['car', 'van'],
        defaultVehicle: 'car',
        costPayer: 'seller',
        baseCost: 8.50,
        etaMinutes: 45,
      },
      'store-003': {
        type: 'own',
        vehicles: ['moto', 'car'],
        defaultVehicle: 'moto',
        costPayer: 'platform',
        baseCost: 0.00,
        etaMinutes: 25,
      },
    };

    const deliveries: DeliveryOrder[] = [];

    for (const order of checkout.orders) {
      const storeId = order.storeId;
      const preferences = storeDeliveryPreferences[storeId] || {
        type: 'third_party' as const,
        vehicles: ['car'] as const,
        defaultVehicle: 'car' as const,
        costPayer: 'buyer' as const,
        baseCost: 10.00,
        etaMinutes: 60,
      };

      const deliveryId = `delivery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${storeId}`;

      const delivery: DeliveryOrder = {
        deliveryId,
        checkoutId,
        storeId,
        type: preferences.type,
        vehicle: preferences.defaultVehicle,
        etaMinutes: preferences.etaMinutes,
        cost: {
          amountCents: Math.round(preferences.baseCost * 100),
          currency: 'BRL',
          payer: preferences.costPayer,
        },
        status: 'created',
      };

      this.deliveries.set(deliveryId, delivery);
      deliveries.push(delivery);
    }

    return deliveries;
  }

  /**
   * Buscar DeliveryOrder por ID
   */
  getDelivery(deliveryId: string): DeliveryOrder | null {
    return this.deliveries.get(deliveryId) || null;
  }

  /**
   * Buscar deliveries por checkoutId
   */
  getDeliveriesByCheckout(checkoutId: string): DeliveryOrder[] {
    return Array.from(this.deliveries.values()).filter(d => d.checkoutId === checkoutId);
  }

  /**
   * Adicionar ServiceOrder a um Order existente
   */
  addServiceOrderToOrder(orderId: string, serviceOrderId: string): {
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
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    const serviceOrders = this.state?.serviceOrders ?? this.facade.services.getServiceOrdersMap();
    const serviceOrder = serviceOrders.get(serviceOrderId);
    if (!serviceOrder) {
      throw new Error('ServiceOrder não encontrado');
    }

    const offering = this.facade.serviceOfferings.get(serviceOrder.offeringId);
    if (!offering) {
      throw new Error('Oferta não encontrada');
    }

    const template = this.facade.services.getServiceTemplates().templates.find(t => t.templateId === offering.templateId);
    const serviceName = template?.name || 'Serviço';

    const serviceBookings = this.state?.serviceBookings ?? this.facade.services.getServiceBookingsMap();
    const booking = serviceBookings.get(serviceOrder.bookingId);
    const quantity = booking?.quantity || 1;

    const subtotal = serviceOrder.price.amountCents * quantity;

    order.items.push({
      productId: `service-${serviceOrder.offeringId}`,
      name: serviceName,
      price: serviceOrder.price,
      quantity,
      subtotal,
    });

    order.totalCents = order.items.reduce((sum, item) => sum + item.subtotal, 0);

    this.orders.set(orderId, order);

    return {
      orderId: order.orderId,
      storeId: order.storeId,
      channel: order.channel,
      origin: order.origin,
      items: order.items,
      totalCents: order.totalCents,
    };
  }
}