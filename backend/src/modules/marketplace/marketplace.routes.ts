// backend/src/modules/marketplace/marketplace.routes.ts
// SPRINT 41.1: MARKETPLACE OPERÁVEL (API + UI MÍNIMA)
// Rotas REST para operar o marketplace end-to-end

import { FastifyPluginAsync } from 'fastify';
import { requirePermission } from '@core/authorization/require-permission.guard';
import { marketplaceService } from './marketplace.service';
import { marketplaceLogger } from './marketplace.logger';
import type { EconomicEvent, PluginDefinition, PluginHook, PluginCategory, ProductTemplate, ServiceTemplateCanonical, BusinessTemplate, VoucherOffer } from '@contracts/marketplace';
import { productCatalogService } from './product-catalog.service';
import { inventoryService } from './inventory.service';
import { inventoryLotService } from './inventory-lot.service';
import { inventoryReservationService } from './inventory-reservation.service';
import { orderService } from './order.service';
import { paymentIntentService } from './payment-intent.service';
import { paymentExecutionService } from './payment-execution.service';
import { paymentSplitService } from './payment-split.service';
import { payoutService } from './payout.service';
import { pricingService } from './pricing.service';
import { auditService } from '@core/audit/audit.service';
import { trustEngineService } from '../trust/trust-engine.service';
import { economicIdentityService } from './economic-identity.service';
import { regionalImpactService } from './regional-impact.service';
import { regionalActivationService } from './regional-activation.service';
import { regionalActivationEventsService } from './regional-activation-events.service';
import { marketplacePluginService } from './marketplace-plugin.service';
import supplierRoutes from './supplier.routes'; // SPRINT 69
import purchaseOrderRoutes from './purchase-order.routes'; // SPRINT 69
import accountsPayableRoutes from './accounts-payable.routes'; // SPRINT 70
import accountsReceivableRoutes from './accounts-receivable.routes'; // SPRINT 71
import paymentMethodRoutes from './payment-method.routes'; // SPRINT 72
import unifyCardRoutes from './unifycard.routes'; // SPRINT 73
import settlementRoutes from './settlement.routes'; // SPRINT 77
import taxProfileRoutes from './tax-profile.routes'; // SPRINT 80
import businessSegmentRoutes from './business-segment.routes'; // SPRINT 81
import unifyCardMethodRoutes from './unifycard-method.routes'; // SPRINT 82
import regionalFeeRoutes from './regional-fee.routes'; // SPRINT 83
import eventSettlementRoutes from './event-settlement.routes'; // SPRINT 84
import financialAgendaRoutes from './financial-agenda.routes'; // SPRINT 85
import contactRoutes from './contact.routes'; // SPRINT 0
import fiscalKycRoutes from './fiscal-kyc.routes'; // SPRINT 84
import pixRoutes from '../payments/pix.routes'; // SPRINT 85
import crmRoutes from '../crm/crm.routes'; // SPRINT 88
// import subscriptionRoutes from '../subscriptions/subscription.routes'; // SPRINT 87 - REMOVIDO: Substituído por rotas integradas do Marketplace
import { venueAdminRoutes } from '../venue/venue.routes'; // SPRINT 92
import loyaltyRoutes from '../loyalty/loyalty.routes'; // SPRINT 93
import presenceRoutes from '../presence/presence.routes'; // SPRINT 94
import liveChatRoutes from '../live-chat/live-chat.routes'; // SPRINT 95

const marketplaceRoutes: FastifyPluginAsync = async (fastify) => {
  marketplaceLogger.init('Rotas protegidas do Marketplace registradas');
  
  // NOTA: Rotas READ-ONLY estáticas foram movidas para marketplace-public.routes.ts
  // e são registradas fora do escopo protegido (sem tenant/auth)
  // Rotas dinâmicas (catálogo, produtos, pedidos, etc.) permanecem aqui

  // SPRINT 69: Suppliers + Purchase Orders
  await fastify.register(supplierRoutes);
  await fastify.register(purchaseOrderRoutes);
  // SPRINT 70: Accounts Payable
  await fastify.register(accountsPayableRoutes);
  // SPRINT 71: Accounts Receivable
  await fastify.register(accountsReceivableRoutes);
  // SPRINT 72: Payment Methods
  await fastify.register(paymentMethodRoutes);
  // SPRINT 73: UnifyCard Acquiring
  await fastify.register(unifyCardRoutes);
  // SPRINT 77: Settlement Regional
  await fastify.register(settlementRoutes);
  // SPRINT 80: Tax Profile
  await fastify.register(taxProfileRoutes);
  // SPRINT 81: Business Segment
  await fastify.register(businessSegmentRoutes);
  // SPRINT 82: UnifyCard Methods
  await fastify.register(unifyCardMethodRoutes);
  // SPRINT 83: Regional Fees
  await fastify.register(regionalFeeRoutes);
  // SPRINT 84: Event Settlements
  await fastify.register(eventSettlementRoutes);
  // SPRINT 85: Financial Agenda
  await fastify.register(financialAgendaRoutes);
  // SPRINT 0: Contacts
  await fastify.register(contactRoutes);
  // SPRINT 84: Fiscal KYC
  await fastify.register(fiscalKycRoutes);
  // SPRINT 85: PIX
  await fastify.register(pixRoutes);
  // SPRINT 88: CRM Canônico
  await fastify.register(crmRoutes, { prefix: '/crm' });
  // SPRINT 87: Assinaturas (REMOVIDO - Substituído por rotas integradas do Marketplace abaixo)
  // await fastify.register(subscriptionRoutes, { prefix: '/subscriptions' });
  // SPRINT 92: Venue (Menu + Tab)
  await fastify.register(venueAdminRoutes);
  // SPRINT 93: Loyalty / Fidelidade
  await fastify.register(loyaltyRoutes, { prefix: '/loyalty' });
  // SPRINT 94: Presence / Check-in Social
  await fastify.register(presenceRoutes, { prefix: '/presence' });
  // SPRINT 95: Live Chat / Presença ao Vivo
  await fastify.register(liveChatRoutes, { prefix: '/live' });

  // ============================================================
  // CATÁLOGO
  // ============================================================

  // GET /marketplace/catalog/categories (rota dinâmica do catálogo, com tenant)
  // TODO: ADAPTER -> categories (core) - Migrar para usar categoriesService ao invés de productCatalogService.listCategories
  // NOTA: A rota estática /marketplace/categories está em marketplace-public.routes.ts
  fastify.get('/catalog/categories', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const options = req.query as any;

    const categories = await productCatalogService.listCategories(tenantId, options);
    return { categories };
  });

  // POST /marketplace/categories
  fastify.post('/categories', {
    preHandler: [requirePermission('marketplace_manage_catalog')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório (V2)
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const category = await productCatalogService.createCategory(tenantId, req.body as any);

    // Registrar auditoria
    await auditService.record(tenantId, {
      event_type: 'MARKETPLACE_CATEGORY_CREATED',
      severity: 'low',
      actor_id: actionContext.actorId,
      actor_type: 'user',
      source: 'validation',
      context: { category_id: category.id, name: category.name },
    });

    return reply.status(201).send(category);
  });

  // GET /marketplace/attributes
  fastify.get('/attributes', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const options = req.query as any;

    const attributes = await productCatalogService.listAttributes(tenantId, options);
    return { attributes };
  });

  // POST /marketplace/attributes
  fastify.post('/attributes', {
    preHandler: [requirePermission('marketplace_manage_catalog')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const attribute = await productCatalogService.createAttribute(tenantId, req.body as any);

    // Registrar auditoria
    await auditService.record(tenantId, {
      event_type: 'MARKETPLACE_ATTRIBUTE_CREATED',
      severity: 'low',
      actor_id: actionContext.actorId,
      actor_type: 'user',
      source: 'validation',
      context: { attribute_id: attribute.id, name: attribute.name },
    });

    return reply.status(201).send(attribute);
  });

  // ============================================================
  // PRODUTOS/VARIANTES
  // ============================================================

  // POST /marketplace/products
  fastify.post('/products', {
    preHandler: [requirePermission('marketplace_manage_products')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const product = await productCatalogService.createProduct(tenantId, req.body as any);

    // Registrar auditoria
    await auditService.record(tenantId, {
      event_type: 'MARKETPLACE_PRODUCT_CREATED',
      severity: 'low',
      actor_id: actionContext.actorId,
      actor_type: 'user',
      source: 'validation',
      context: { product_id: product.id, name: product.name },
    });

    return reply.status(201).send(product);
  });

  // GET /marketplace/products
  fastify.get('/products', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const options = req.query as any;

    const products = await productCatalogService.listProducts(tenantId, options);
    return { products };
  });

  // POST /marketplace/products/:productId/variants
  fastify.post<{ Params: { productId: string } }>('/products/:productId/variants', {
    preHandler: [requirePermission('marketplace_manage_products')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { productId } = req.params;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const variant = await productCatalogService.createVariant(tenantId, {
      ...req.body,
      productId,
    } as any);

    // Registrar auditoria
    await auditService.record(tenantId, {
      event_type: 'MARKETPLACE_VARIANT_CREATED',
      severity: 'low',
      actor_id: actionContext.actorId,
      actor_type: 'user',
      source: 'validation',
      context: { variant_id: variant.id, product_id: productId, sku: variant.sku },
    });

    return reply.status(201).send(variant);
  });

  // GET /marketplace/products/:productId/variants
  fastify.get<{ Params: { productId: string } }>('/products/:productId/variants', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { productId } = req.params;

    const variants = await productCatalogService.listVariantsByProduct(tenantId, productId);
    return { variants };
  });

  // ============================================================
  // PRICING (SPRINT 48)
  // ============================================================

  // GET /marketplace/pricing/variant/:variantId
  fastify.get<{ Params: { variantId: string } }>('/pricing/variant/:variantId', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { variantId } = req.params;
    const query = req.query as any;

    // Buscar produto e categoria para contexto
    const variant = await productCatalogService.getVariantById(tenantId, variantId);
    if (!variant) {
      return reply.status(404).send({ error: 'Variante não encontrada' });
    }

    const product = await productCatalogService.getProductById(tenantId, variant.productId);
    if (!product) {
      return reply.status(404).send({ error: 'Produto não encontrado' });
    }

    const priceBreakdown = await pricingService.getCurrentPrice(tenantId, {
      variantId,
      productId: product.id,
      categoryId: product.categoryId || undefined,
      quantity: query.quantity ? parseFloat(query.quantity) : undefined,
      userId: query.userId,
      date: query.date ? new Date(query.date) : undefined,
    });

    return reply.status(200).send(priceBreakdown);
  });

  // POST /marketplace/pricing/prices
  fastify.post('/pricing/prices', {
    preHandler: [requirePermission('marketplace_manage_products')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const price = await pricingService.createPrice(tenantId, req.body as any);

    // Registrar auditoria
    await auditService.record(tenantId, {
      event_type: 'MARKETPLACE_PRICE_CREATED',
      severity: 'medium',
      actor_id: actionContext.actorId,
      actor_type: 'user',
      source: 'validation',
      context: { price_id: price.id, variant_id: price.productVariantId, price: price.price },
    });

    return reply.status(201).send(price);
  });

  // GET /marketplace/pricing/prices?variantId=...
  fastify.get('/pricing/prices', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { variantId } = req.query as any;

    if (!variantId) {
      return reply.status(400).send({ error: 'variantId query parameter is required' });
    }

    const prices = await pricingService.listPricesByVariant(tenantId, variantId);
    return { prices };
  });

  // POST /marketplace/pricing/promotions
  fastify.post('/pricing/promotions', {
    preHandler: [requirePermission('marketplace_manage_products')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const promotion = await pricingService.createPromotion(tenantId, req.body as any);

    // Registrar auditoria
    await auditService.record(tenantId, {
      event_type: 'MARKETPLACE_PROMOTION_CREATED',
      severity: 'medium',
      actor_id: actionContext.actorId,
      actor_type: 'user',
      source: 'validation',
      context: { promotion_id: promotion.id, name: promotion.name, type: promotion.type },
    });

    return reply.status(201).send(promotion);
  });

  // GET /marketplace/pricing/promotions
  fastify.get('/pricing/promotions', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { isActive } = req.query as any;

    const promotions = await pricingService.listPromotions(
      tenantId,
      isActive !== undefined ? isActive === 'true' : undefined
    );
    return { promotions };
  });

  // ============================================================
  // ESTOQUE
  // ============================================================

  // POST /marketplace/inventory/movements
  fastify.post('/inventory/movements', {
    preHandler: [requirePermission('marketplace_manage_inventory')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const movement = await inventoryService.addMovement(tenantId, req.body as any);

    // Registrar auditoria
    await auditService.record(tenantId, {
      event_type: 'MARKETPLACE_INVENTORY_MOVEMENT',
      severity: 'low',
      actor_id: actionContext.actorId,
      actor_type: 'user',
      source: 'validation',
      context: {
        movement_id: movement.id,
        variant_id: movement.productVariantId,
        movement_type: movement.movementType,
        quantity: movement.quantity,
      },
    });

    return reply.status(201).send(movement);
  });

  // GET /marketplace/inventory/movements?variantId=...
  fastify.get('/inventory/movements', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { variantId } = req.query as any;

    if (!variantId) {
      return reply.status(400).send({ error: 'variantId query parameter is required' });
    }

    const movements = await inventoryService.getMovements(tenantId, variantId, {});
    return { movements };
  });

  // GET /marketplace/inventory/balance?variantId=...
  fastify.get('/inventory/balance', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { variantId } = req.query as any;

    if (!variantId) {
      return reply.status(400).send({ error: 'variantId query parameter is required' });
    }

    const balance = await inventoryService.getCurrentBalance(tenantId, variantId);
    return { balance };
  });

  // GET /marketplace/inventory/available?variantId=...
  fastify.get('/inventory/available', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { variantId } = req.query as any;

    if (!variantId) {
      return reply.status(400).send({ error: 'variantId query parameter is required' });
    }

    // SPRINT 43: Retornar estoque disponível (saldo real - reservas ativas)
    const available = await inventoryReservationService.getAvailableStock(tenantId, variantId);
    return { availableStock: available };
  });

  // POST /marketplace/inventory/lots
  fastify.post('/inventory/lots', {
    preHandler: [requirePermission('marketplace_manage_inventory')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const lot = await inventoryLotService.createLot(tenantId, req.body as any);

    // Registrar auditoria
    await auditService.record(tenantId, {
      event_type: 'MARKETPLACE_INVENTORY_LOT_CREATED',
      severity: 'low',
      actor_id: actionContext.actorId,
      actor_type: 'user',
      source: 'validation',
      context: { lot_id: lot.id, variant_id: lot.productVariantId, lot_code: lot.lotCode },
    });

    return reply.status(201).send(lot);
  });

  // GET /marketplace/inventory/lots?variantId=...
  fastify.get('/inventory/lots', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { variantId } = req.query as any;

    if (!variantId) {
      return reply.status(400).send({ error: 'variantId query parameter is required' });
    }

    const lots = await inventoryLotService.listLotsByVariant(tenantId, variantId);
    return { lots };
  });

  // ============================================================
  // PEDIDOS
  // ============================================================

  // POST /marketplace/orders
  fastify.post('/orders', {
    preHandler: [requirePermission('marketplace_manage_orders')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const order = await orderService.createOrder(tenantId, req.body as any);

    // Registrar auditoria
    await auditService.record(tenantId, {
      event_type: 'MARKETPLACE_ORDER_CREATED',
      severity: 'low',
      actor_id: actionContext.actorId,
      actor_type: 'user',
      source: 'validation',
      context: { order_id: order.id, buyer_actor_id: order.buyerActorId, seller_actor_id: order.sellerActorId },
    });

    return reply.status(201).send(order);
  });

  // GET /marketplace/orders
  fastify.get('/orders', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const options = req.query as any;

    const orders = await orderService.listOrders(tenantId, options);
    return { orders };
  });

  // POST /marketplace/orders/:orderId/items
  fastify.post<{ Params: { orderId: string } }>('/orders/:orderId/items', {
    preHandler: [requirePermission('marketplace_manage_orders')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { orderId } = req.params;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const item = await orderService.addItem(tenantId, orderId, req.body as any);

    // Registrar auditoria
    await auditService.record(tenantId, {
      event_type: 'MARKETPLACE_ORDER_ITEM_ADDED',
      severity: 'low',
      actor_id: actionContext.actorId,
      actor_type: 'user',
      source: 'validation',
      context: { order_id: orderId, item_id: item.id, variant_id: item.productVariantId },
    });

    return reply.status(201).send(item);
  });

  // DELETE /marketplace/orders/:orderId/items/:itemId
  fastify.delete<{ Params: { orderId: string; itemId: string } }>('/orders/:orderId/items/:itemId', {
    preHandler: [requirePermission('marketplace_manage_orders')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { orderId, itemId } = req.params;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    await orderService.removeItem(tenantId, orderId, itemId);

    // Registrar auditoria
    await auditService.record(tenantId, {
      event_type: 'MARKETPLACE_ORDER_ITEM_REMOVED',
      severity: 'low',
      actor_id: actionContext.actorId,
      actor_type: 'user',
      source: 'validation',
      context: { order_id: orderId, item_id: itemId },
    });

    return reply.status(204).send();
  });

  // POST /marketplace/orders/:orderId/submit
  fastify.post<{ Params: { orderId: string } }>('/orders/:orderId/submit', {
    preHandler: [requirePermission('marketplace_manage_orders')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { orderId } = req.params;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const order = await orderService.submitOrder(tenantId, orderId);

    // Registrar auditoria
    await auditService.record(tenantId, {
      event_type: 'MARKETPLACE_ORDER_SUBMITTED',
      severity: 'medium',
      actor_id: actionContext.actorId,
      actor_type: 'user',
      source: 'validation',
      context: { order_id: orderId },
    });

    return order;
  });

  // POST /marketplace/orders/:orderId/cancel
  fastify.post<{ Params: { orderId: string } }>('/orders/:orderId/cancel', {
    preHandler: [requirePermission('marketplace_manage_orders')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { orderId } = req.params;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const order = await orderService.cancelOrder(tenantId, orderId);

    // Registrar auditoria
    await auditService.record(tenantId, {
      event_type: 'MARKETPLACE_ORDER_CANCELLED',
      severity: 'medium',
      actor_id: actionContext.actorId,
      actor_type: 'user',
      source: 'validation',
      context: { order_id: orderId },
    });

    return order;
  });

  // GET /marketplace/orders/:orderId/history
  fastify.get<{ Params: { orderId: string } }>('/orders/:orderId/history', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { orderId } = req.params;

    const history = await orderService.getStatusHistory(tenantId, orderId);
    return { history };
  });

  // ============================================================
  // PAGAMENTOS + EXECUÇÃO + SPLIT + PAYOUT
  // ============================================================

  // POST /marketplace/payment-intents
  fastify.post('/payment-intents', {
    preHandler: [requirePermission('marketplace_execute_payments')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const intent = await paymentIntentService.createPaymentIntent(tenantId, req.body as any);

    // Registrar auditoria
    await auditService.record(tenantId, {
      event_type: 'MARKETPLACE_PAYMENT_INTENT_CREATED',
      severity: 'medium',
      actor_id: actionContext.actorId,
      actor_type: 'user',
      source: 'validation',
      context: { payment_intent_id: intent.id, order_id: intent.orderId, amountCents: intent.amountCents },
    });

    return reply.status(201).send(intent);
  });

  // POST /marketplace/payment-intents/:intentId/authorize
  fastify.post<{ Params: { intentId: string } }>('/payment-intents/:intentId/authorize', {
    preHandler: [requirePermission('marketplace_execute_payments')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { intentId } = req.params;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const intent = await paymentIntentService.authorizePaymentIntent(tenantId, intentId);

    // Registrar auditoria
    await auditService.record(tenantId, {
      event_type: 'MARKETPLACE_PAYMENT_INTENT_AUTHORIZED',
      severity: 'medium',
      actor_id: actionContext.actorId,
      actor_type: 'user',
      source: 'validation',
      context: { payment_intent_id: intentId },
    });

    return intent;
  });

  // POST /marketplace/payments/execute
  fastify.post('/payments/execute', {
    preHandler: [requirePermission('marketplace_execute_payments')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;
    const { paymentIntentId, buyerActorId, sellerActorId } = req.body as any;
    
    // SPRINT 41.2: Idempotência - aceitar header opcional Idempotency-Key
    const idempotencyKey = (req.headers['idempotency-key'] as string) || undefined;

    // ActionContext é obrigatório
    // ActionContext é obrigatório (V2)
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const transaction = await paymentExecutionService.executePayment(tenantId, {
      paymentIntentId,
      buyerActorId,
      sellerActorId,
      actingUserId: actionContext.actorId,
      idempotencyKey,
    });

    // Auditoria já registrada no service
    return reply.status(201).send(transaction);
  });

  // POST /marketplace/payment-splits/define
  fastify.post('/payment-splits/define', {
    preHandler: [requirePermission('marketplace_manage_splits')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;
    const { paymentIntentId, splits } = req.body as any;

    // ActionContext é obrigatório
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const definedSplits = await paymentSplitService.defineSplits(tenantId, paymentIntentId, { splits });

    // Registrar auditoria
    await auditService.record(tenantId, {
      event_type: 'MARKETPLACE_PAYMENT_SPLITS_DEFINED',
      severity: 'medium',
      actor_id: actionContext.actorId,
      actor_type: 'user',
      source: 'validation',
      context: { payment_intent_id: paymentIntentId, splits_count: definedSplits.length },
    });

    return reply.status(201).send({ splits: definedSplits });
  });

  // POST /marketplace/payouts/execute
  fastify.post('/payouts/execute', {
    preHandler: [requirePermission('marketplace_execute_payouts')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;
    const { paymentIntentId } = req.body as any;
    
    // SPRINT 41.2: Idempotência - aceitar header opcional Idempotency-Key
    const idempotencyKey = (req.headers['idempotency-key'] as string) || undefined;

    // ActionContext é obrigatório (V2)
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const payouts = await payoutService.executePayout(tenantId, {
      paymentIntentId,
      actingUserId: actionContext.actorId,
      idempotencyKey,
    });

    // Auditoria já registrada no service
    return reply.status(201).send({ payouts });
  });

  // GET /marketplace/payouts?paymentIntentId=...
  fastify.get('/payouts', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { paymentIntentId } = req.query as any;

    if (!paymentIntentId) {
      return reply.status(400).send({ error: 'paymentIntentId query parameter is required' });
    }

    const payouts = await payoutService.getPayoutsByIntent(tenantId, paymentIntentId);
    return { payouts };
  });

  // ============================================================
  // REFERÊNCIAS (SOCIAL PLUGIN - READ-ONLY)
  // ============================================================

  // GET /marketplace/refs/:type/:id
  fastify.get<{ Params: { type: string; id: string } }>('/refs/:type/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { type, id } = req.params;

    try {
      if (type === 'product_variant') {
        const variant = await productCatalogService.getVariantById(tenantId, id);
        if (!variant) {
          return reply.status(404).send({ error: 'Product variant not found' });
        }
        const product = await productCatalogService.getProductById(tenantId, variant.productId);
        return {
          type: 'product_variant',
          id: variant.id,
          name: product?.name || 'Produto',
          status: variant.isActive ? 'active' : 'inactive',
          link: `/marketplace?tab=products&productId=${variant.productId}`,
        };
      } else if (type === 'order') {
        const order = await orderService.getOrderById(tenantId, id);
        if (!order) {
          return reply.status(404).send({ error: 'Order not found' });
        }
        return {
          type: 'order',
          id: order.id,
          name: `Pedido #${order.id.substring(0, 8)}`,
          status: order.status.toLowerCase(),
          link: `/marketplace?tab=orders&orderId=${order.id}`,
        };
      } else if (type === 'payment_intent') {
        const intent = await paymentIntentService.getIntentById(tenantId, id);
        if (!intent) {
          return reply.status(404).send({ error: 'Payment intent not found' });
        }
        return {
          type: 'payment_intent',
          id: intent.id,
          name: `Pagamento #${intent.id.substring(0, 8)}`,
          status: intent.status.toLowerCase(),
          link: `/marketplace?tab=payments&intentId=${intent.id}`,
        };
      } else {
        return reply.status(400).send({ error: `Invalid type: ${type}. Valid types: product_variant, order, payment_intent` });
      }
    } catch (error: any) {
      return reply.status(500).send({ error: error.message || 'Internal server error' });
    }
  });

  // ============================================================
  // PAYMENT PLAN EXECUTION (PROTECTED)
  // ============================================================
  
  // POST /marketplace/payment-plan/:paymentPlanId/execute
  fastify.post<{ Params: { paymentPlanId: string } }>('/payment-plan/:paymentPlanId/execute', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;
    const userId = actionContext?.actorId;

    if (!userId) {
      return reply.status(401).send({ error: 'Usuário não autenticado' });
    }

    const { paymentPlanId } = req.params;

    try {
      const result = await marketplaceService.executePaymentPlan(tenantId, userId, paymentPlanId);
      return reply.status(200).send(result);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || 'Erro ao executar pagamento' });
    }
  });

  // ============================================================
  // LOGÍSTICA (DELIVERY)
  // ============================================================
  
  // POST /marketplace/delivery/from-checkout/:checkoutId
  fastify.post<{ Params: { checkoutId: string } }>('/delivery/from-checkout/:checkoutId', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { checkoutId } = req.params;

    try {
      const deliveries = marketplaceService.createDeliveryFromCheckout(checkoutId);
      return reply.status(201).send({ deliveries });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || 'Erro ao criar entrega' });
    }
  });

  // GET /marketplace/delivery/:deliveryId
  fastify.get<{ Params: { deliveryId: string } }>('/delivery/:deliveryId', async (req, reply) => {
    const { deliveryId } = req.params;
    
    const delivery = marketplaceService.getDelivery(deliveryId);
    
    if (!delivery) {
      return reply.status(404).send({ error: 'Entrega não encontrada' });
    }
    
    return reply.status(200).send(delivery);
  });

  // GET /marketplace/delivery/checkout/:checkoutId
  fastify.get<{ Params: { checkoutId: string } }>('/delivery/checkout/:checkoutId', async (req, reply) => {
    const { checkoutId } = req.params;
    
    const deliveries = marketplaceService.getDeliveriesByCheckout(checkoutId);
    
    return reply.status(200).send({ deliveries });
  });

  // ============================================================
  // PDV (PONTO DE VENDA) - ERP LIGHT
  // ============================================================

  // POST /marketplace/pdv/order
  fastify.post('/pdv/order', {
    preHandler: [requirePermission('marketplace_pdv_sell')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const body = req.body as {
      store_id: string;
      items: Array<{
        product_id: string;
        quantity: number;
      }>;
      customer_id?: string;
    };

    if (!body.store_id || !body.items || body.items.length === 0) {
      return reply.status(400).send({ error: 'store_id e items são obrigatórios' });
    }

    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const order = await marketplaceService.createPhysicalOrder(tenantId, {
        storeId: body.store_id,
        items: body.items.map((i: { product_id: string; quantity: number }) => ({ productId: i.product_id, quantity: i.quantity })),
        customer_id: body.customer_id,
      });
      return reply.status(201).send(order);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || 'Erro ao criar pedido PDV' });
    }
  });

  // POST /marketplace/pdv/customer
  fastify.post('/pdv/customer', {
    preHandler: [requirePermission('marketplace_pdv_manage_customers')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const body = req.body as {
      store_id: string;
      name?: string;
      phone?: string;
      linked_user_id?: string;
    };

    if (!body.store_id) {
      return reply.status(400).send({ error: 'store_id é obrigatório' });
    }

    try {
      const customer = marketplaceService.createStoreCustomer({
        storeId: body.store_id,
        name: body.name,
        phone: body.phone,
        linked_user_id: body.linked_user_id,
      });
      return reply.status(201).send(customer);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || 'Erro ao criar cliente' });
    }
  });

  // GET /marketplace/pdv/customer/:customerId
  fastify.get<{ Params: { customerId: string } }>('/pdv/customer/:customerId', {
    preHandler: [requirePermission('marketplace_pdv_view_customers')],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { customerId } = req.params;

    const customer = marketplaceService.getStoreCustomer(customerId);
    if (!customer) {
      return reply.status(404).send({ error: 'Cliente não encontrado' });
    }

    return reply.status(200).send(customer);
  });

  // ============================================================
  // SERVIÇOS, AGENDA E RECORRÊNCIA
  // ============================================================

  // GET /marketplace/services/templates
  fastify.get('/services/templates', async (req, reply) => {
    const templates = marketplaceService.getServiceTemplates();
    return reply.status(200).send(templates);
  });

  // GET /marketplace/services/store/:storeId/offerings
  fastify.get<{ Params: { storeId: string } }>('/services/store/:storeId/offerings', async (req, reply) => {
    const { storeId } = req.params;
    const offerings = marketplaceService.getStoreServiceOfferings(storeId);
    return reply.status(200).send(offerings);
  });

  // GET /marketplace/services/offering/:offeringId/availability
  fastify.get<{ Params: { offeringId: string } }>('/services/offering/:offeringId/availability', async (req, reply) => {
    const { offeringId } = req.params;
    const availability = marketplaceService.getServiceAvailability(offeringId);
    return reply.status(200).send({ availability });
  });

  // POST /marketplace/services/booking
  fastify.post('/services/booking', async (req, reply) => {
    const body = req.body as {
      offering_id: string;
      user_id: string;
      date: string;
      time: string;
      quantity: number;
    };

    if (!body.offering_id || !body.user_id || !body.date || !body.time || !body.quantity) {
      return reply.status(400).send({ error: 'Todos os campos são obrigatórios' });
    }

    try {
      const booking = marketplaceService.createServiceBooking({
        offeringId: body.offering_id,
        user_id: body.user_id,
        date: body.date,
        time: body.time,
        quantity: body.quantity,
      });
      return reply.status(201).send(booking);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || 'Erro ao criar reserva' });
    }
  });

  // POST /marketplace/services/booking/:bookingId/confirm
  fastify.post<{ Params: { bookingId: string } }>('/services/booking/:bookingId/confirm', async (req, reply) => {
    const { bookingId } = req.params;

    try {
      const result = marketplaceService.confirmServiceBooking(bookingId);
      return reply.status(200).send(result);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || 'Erro ao confirmar reserva' });
    }
  });

  // GET /marketplace/services/booking/:bookingId
  fastify.get<{ Params: { bookingId: string } }>('/services/booking/:bookingId', async (req, reply) => {
    const { bookingId } = req.params;
    const booking = marketplaceService.getServiceBooking(bookingId);
    
    if (!booking) {
      return reply.status(404).send({ error: 'Reserva não encontrada' });
    }

    return reply.status(200).send(booking);
  });

  // POST /marketplace/services/order/:orderId/add-service/:serviceOrderId
  fastify.post<{ Params: { orderId: string; serviceOrderId: string } }>('/services/order/:orderId/add-service/:serviceOrderId', async (req, reply) => {
    const { orderId, serviceOrderId } = req.params;

    try {
      const order = marketplaceService.addServiceOrderToOrder(orderId, serviceOrderId);
      return reply.status(200).send(order);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || 'Erro ao adicionar serviço ao pedido' });
    }
  });

  // ============================================================
  // SUBSCRIPTIONS (ASSINATURAS E RECORRÊNCIA)
  // ============================================================

  // POST /marketplace/subscriptions
  fastify.post<{
    Body: {
      type: 'product' | 'service' | 'mixed';
      billing_cycle: 'weekly' | 'monthly' | 'yearly';
      starts_at: string;
      linked_entities: {
        products?: Array<{ product_id: string; store_id: string; quantity: number }>;
        service_offerings?: Array<{ offering_id: string; store_id: string; quantity: number }>;
      };
      customer_id: string;
      store_id: string;
      payment_method: 'balance' | 'card' | 'invoice';
      attribution_id?: string;
    };
  }>('/subscriptions', {
    preHandler: requirePermission('marketplace_manage_orders'),
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const subBody = req.body as Record<string, unknown>;
      const linked = (subBody.linked_entities || {}) as Record<string, unknown>;
      const subscription = await marketplaceService.createSubscription(tenantId, {
        type: subBody.type as 'product' | 'service' | 'mixed',
        billingCycle: (subBody.billing_cycle as 'weekly' | 'monthly' | 'yearly') ?? 'monthly',
        starts_at: (subBody.starts_at as string) ?? '',
        linked_entities: {
          products: (linked.products as Array<{ product_id: string; store_id: string; quantity: number }> | undefined)?.map((p) => ({ productId: p.product_id, storeId: p.store_id, quantity: p.quantity })),
          service_offerings: (linked.service_offerings as Array<{ offering_id: string; store_id: string; quantity: number }> | undefined)?.map((s) => ({ offering_id: s.offering_id, storeId: s.store_id, quantity: s.quantity })),
        },
        customer_id: (subBody.customer_id as string) ?? '',
        storeId: (subBody.store_id as string) ?? '',
        payment_method: (subBody.payment_method as 'balance' | 'card' | 'invoice') ?? 'balance',
        attribution_id: subBody.attribution_id as string | undefined,
      });
      marketplaceLogger.api('Subscription criada', { subscription_id: subscription.subscriptionId });
      return reply.status(201).send(subscription);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao criar subscription', error);
      return reply.status(400).send({ error: error.message || 'Erro ao criar assinatura' });
    }
  });

  // GET /marketplace/subscriptions/:subscriptionId
  fastify.get<{ Params: { subscriptionId: string } }>('/subscriptions/:subscriptionId', {
    preHandler: requirePermission('marketplace_manage_orders'),
  }, async (req, reply) => {
    try {
      const { subscriptionId } = req.params;
      const subscription = marketplaceService.getSubscription(subscriptionId);
      
      if (!subscription) {
        return reply.status(404).send({ error: 'Assinatura não encontrada' });
      }

      return reply.status(200).send(subscription);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar subscription', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar assinatura' });
    }
  });

  // GET /marketplace/subscriptions/customer/:customerId
  fastify.get<{ Params: { customerId: string } }>('/subscriptions/customer/:customerId', {
    preHandler: requirePermission('marketplace_manage_orders'),
  }, async (req, reply) => {
    try {
      const { customerId } = req.params;
      const subscriptions = marketplaceService.getCustomerSubscriptions(customerId);
      return reply.status(200).send({ subscriptions });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar subscriptions do cliente', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar assinaturas' });
    }
  });

  // GET /marketplace/subscriptions/store/:storeId
  fastify.get<{ Params: { storeId: string } }>('/subscriptions/store/:storeId', {
    preHandler: requirePermission('marketplace_manage_orders'),
  }, async (req, reply) => {
    try {
      const { storeId } = req.params;
      const subscriptions = marketplaceService.getStoreSubscriptions(storeId);
      return reply.status(200).send({ subscriptions });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar subscriptions da loja', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar assinaturas' });
    }
  });

  // POST /marketplace/subscriptions/:subscriptionId/pause
  fastify.post<{ Params: { subscriptionId: string } }>('/subscriptions/:subscriptionId/pause', {
    preHandler: requirePermission('marketplace_manage_orders'),
  }, async (req, reply) => {
    try {
      const { subscriptionId } = req.params;
      const subscription = marketplaceService.pauseSubscription(subscriptionId);
      marketplaceLogger.api('Subscription pausada', { subscription_id: subscriptionId });
      return reply.status(200).send(subscription);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao pausar subscription', error);
      return reply.status(400).send({ error: error.message || 'Erro ao pausar assinatura' });
    }
  });

  // POST /marketplace/subscriptions/:subscriptionId/resume
  fastify.post<{ Params: { subscriptionId: string } }>('/subscriptions/:subscriptionId/resume', {
    preHandler: requirePermission('marketplace_manage_orders'),
  }, async (req, reply) => {
    try {
      const { subscriptionId } = req.params;
      const subscription = marketplaceService.resumeSubscription(subscriptionId);
      marketplaceLogger.api('Subscription retomada', { subscription_id: subscriptionId });
      return reply.status(200).send(subscription);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao retomar subscription', error);
      return reply.status(400).send({ error: error.message || 'Erro ao retomar assinatura' });
    }
  });

  // POST /marketplace/subscriptions/:subscriptionId/cancel
  fastify.post<{ Params: { subscriptionId: string } }>('/subscriptions/:subscriptionId/cancel', {
    preHandler: requirePermission('marketplace_manage_orders'),
  }, async (req, reply) => {
    try {
      const { subscriptionId } = req.params;
      const subscription = marketplaceService.cancelSubscription(subscriptionId);
      marketplaceLogger.api('Subscription cancelada', { subscription_id: subscriptionId });
      return reply.status(200).send(subscription);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao cancelar subscription', error);
      return reply.status(400).send({ error: error.message || 'Erro ao cancelar assinatura' });
    }
  });

  // POST /marketplace/subscriptions/:subscriptionId/generate-cycle
  fastify.post<{ Params: { subscriptionId: string } }>('/subscriptions/:subscriptionId/generate-cycle', {
    preHandler: requirePermission('marketplace_execute_payments'),
  }, async (req, reply) => {
    try {
      const tenantId = req.tenant!.id;
      const userId = req.user!.id;
      const { subscriptionId } = req.params;

      const result = await marketplaceService.generateSubscriptionCycle(
        tenantId,
        userId,
        subscriptionId
      );

      marketplaceLogger.api('Subscription cycle gerado', {
        subscription_id: subscriptionId,
        cycle_id: result.cycle.cycleId,
      });

      return reply.status(201).send(result);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao gerar subscription cycle', error);
      return reply.status(400).send({ error: error.message || 'Erro ao gerar ciclo de assinatura' });
    }
  });

  // GET /marketplace/subscriptions/:subscriptionId/cycles
  fastify.get<{ Params: { subscriptionId: string } }>('/subscriptions/:subscriptionId/cycles', {
    preHandler: requirePermission('marketplace_manage_orders'),
  }, async (req, reply) => {
    try {
      const { subscriptionId } = req.params;
      const cycles = marketplaceService.getSubscriptionCycles(subscriptionId);
      return reply.status(200).send({ cycles });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar cycles da subscription', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar ciclos' });
    }
  });

  // GET /marketplace/subscription-cycles/:cycleId
  fastify.get<{ Params: { cycleId: string } }>('/subscription-cycles/:cycleId', {
    preHandler: requirePermission('marketplace_manage_orders'),
  }, async (req, reply) => {
    try {
      const { cycleId } = req.params;
      const cycle = marketplaceService.getSubscriptionCycle(cycleId);
      
      if (!cycle) {
        return reply.status(404).send({ error: 'Ciclo não encontrado' });
      }

      return reply.status(200).send(cycle);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar subscription cycle', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar ciclo' });
    }
  });

  // ============================================================
  // INDÚSTRIA E DISTRIBUIÇÃO REGIONAL
  // ============================================================

  // POST /marketplace/industries
  fastify.post<{
    Body: {
      name: string;
      cnpj: string;
      categories_supported: string[];
      default_margin_rules: {
        hub_margin_percentage: number;
        store_margin_percentage: number;
        minimum_price?: number;
      };
      authorized_hubs?: string[];
    };
  }>('/industries', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const body = req.body;
      const input = {
        name: body.name,
        cnpj: body.cnpj,
        categoriesSupported: body.categories_supported,
        defaultMarginRules: {
          hubMarginBps: body.default_margin_rules.hub_margin_percentage,
          storeMarginBps: body.default_margin_rules.store_margin_percentage,
          minimum_price: body.default_margin_rules.minimum_price,
        },
        authorizedHubs: body.authorized_hubs,
      };
      const industry = marketplaceService.createIndustryAccount(input);
      marketplaceLogger.api('Industry account criada', { industry_id: industry.industryId });
      return reply.status(201).send(industry);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao criar industry account', error);
      return reply.status(400).send({ error: error.message || 'Erro ao criar conta de indústria' });
    }
  });

  // GET /marketplace/industries
  fastify.get('/industries', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const industries = marketplaceService.getIndustryAccounts();
      return reply.status(200).send({ industries });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar industries', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar indústrias' });
    }
  });

  // GET /marketplace/industries/:industryId
  fastify.get<{ Params: { industryId: string } }>('/industries/:industryId', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { industryId } = req.params;
      const industry = marketplaceService.getIndustryAccount(industryId);
      
      if (!industry) {
        return reply.status(404).send({ error: 'Indústria não encontrada' });
      }

      return reply.status(200).send(industry);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar industry', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar indústria' });
    }
  });

  // POST /marketplace/hubs
  fastify.post<{
    Body: {
      industry_id: string;
      name: string;
      location: {
        country: string;
        state: string;
        city: string;
        neighborhood?: string;
        address?: string;
        latitude?: number;
        longitude?: number;
      };
      supported_products: string[];
      fulfillment_type: 'pickup' | 'delivery' | 'mixed';
      margin_override?: {
        percentage?: number;
        fixed_amount?: number;
      };
      logistics_profile: {
        default_eta_minutes: number;
        supported_vehicles: Array<'bike' | 'moto' | 'car' | 'van' | 'truck'>;
        cost_per_km?: number;
        base_cost?: number;
      };
    };
  }>('/hubs', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const b = req.body as Record<string, unknown>;
      const loc = (b.location || {}) as Record<string, unknown>;
      const hub = marketplaceService.createDistributionHub({
        industryId: b.industry_id as string,
        name: b.name as string,
        location: {
          country: (loc.country as string) ?? '',
          state: (loc.state as string) ?? '',
          city: (loc.city as string) ?? '',
          neighborhood: loc.neighborhood as string | undefined,
          address: loc.address as string | undefined,
          latitude: loc.latitude as number | undefined,
          longitude: loc.longitude as number | undefined,
        },
        supportedProducts: (b.supported_products as string[]) ?? [],
        fulfillmentType: (b.fulfillment_type as 'pickup' | 'delivery' | 'mixed') ?? 'mixed',
        margin_override: b.margin_override as Record<string, unknown> | undefined,
        logistics_profile: b.logistics_profile as Record<string, unknown> | undefined,
      });
      marketplaceLogger.api('Distribution hub criado', { hub_id: hub.hubId });
      return reply.status(201).send(hub);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao criar distribution hub', error);
      return reply.status(400).send({ error: error.message || 'Erro ao criar hub de distribuição' });
    }
  });

  // GET /marketplace/hubs/industry/:industryId
  fastify.get<{ Params: { industryId: string } }>('/hubs/industry/:industryId', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { industryId } = req.params;
      const hubs = marketplaceService.getIndustryHubs(industryId);
      return reply.status(200).send({ hubs });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar hubs da indústria', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar hubs' });
    }
  });

  // POST /marketplace/payment-plan/dropship
  fastify.post<{
    Body: {
      checkout_id: string;
      method: 'balance' | 'card' | 'invoice';
      dropship_items: Array<{
        product_id: string;
        industry_id: string;
        hub_id: string;
        store_id: string;
        quantity: number;
        unit_price: number;
      }>;
    };
  }>('/payment-plan/dropship', {
    preHandler: requirePermission('marketplace_execute_payments'),
  }, async (req, reply) => {
    try {
      const dropshipBody = req.body as { checkout_id: string; method: 'balance' | 'card' | 'invoice'; dropship_items: Array<{ product_id: string; industry_id: string; hub_id: string; store_id: string; quantity: number; unit_price: number }> };
      const paymentPlan = marketplaceService.createPaymentPlanWithDropship(
        dropshipBody.checkout_id,
        dropshipBody.method,
        dropshipBody.dropship_items.map((i) => ({
          productId: i.product_id,
          industryId: i.industry_id,
          hubId: i.hub_id,
          storeId: i.store_id,
          quantity: i.quantity,
          unitPrice: i.unit_price,
        }))
      );
      marketplaceLogger.api('PaymentPlan criado com dropship', {
        payment_plan_id: paymentPlan.paymentPlanId,
      });
      return reply.status(201).send(paymentPlan);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao criar payment plan com dropship', error);
      return reply.status(400).send({ error: error.message || 'Erro ao criar payment plan' });
    }
  });

  // POST /marketplace/delivery/from-hub
  fastify.post<{
    Body: {
      checkout_id: string;
      hub_id: string;
      store_id: string;
    };
  }>('/delivery/from-hub', {
    preHandler: requirePermission('marketplace_manage_orders'),
  }, async (req, reply) => {
    try {
      const delivery = marketplaceService.createDeliveryFromHub(
        req.body.checkout_id,
        req.body.hub_id,
        req.body.store_id
      );
      marketplaceLogger.api('Delivery criado via hub', { delivery_id: delivery.deliveryId });
      return reply.status(201).send(delivery);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao criar delivery via hub', error);
      return reply.status(400).send({ error: error.message || 'Erro ao criar entrega' });
    }
  });

  // ============================================================
  // GOVERNANÇA, SLA, REPUTAÇÃO E RISCO
  // ============================================================

  // POST /marketplace/sla-contracts
  fastify.post<{
    Body: {
      actor_type: 'store' | 'hub' | 'industry' | 'service_provider';
      actor_id: string;
      metrics: {
        fulfilled_at: { target_hours: number; max_hours: number };
        cancellation_rate: { target_percentage: number; max_percentage: number };
        dispute_rate: { target_percentage: number; max_percentage: number };
      };
      thresholds: {
        warning: {
          fulfillment_time_hours: number;
          cancellation_rate_percentage: number;
          dispute_rate_percentage: number;
        };
        violation: {
          fulfillment_time_hours: number;
          cancellation_rate_percentage: number;
          dispute_rate_percentage: number;
        };
      };
      penalties: {
        fulfillment_time_violation: { type: 'percentage' | 'fixed'; valueCents: number; redirect_to: 'regional_fund' | 'customer' | 'platform' };
        cancellation_rate_violation: { type: 'percentage' | 'fixed'; valueCents: number; redirect_to: 'regional_fund' | 'customer' | 'platform' };
        dispute_rate_violation: { type: 'percentage' | 'fixed'; valueCents: number; redirect_to: 'regional_fund' | 'customer' | 'platform' };
      };
    };
  }>('/sla-contracts', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const body = req.body;
      const input = {
        actorType: body.actor_type,
        actorId: body.actor_id,
        metrics: {
          fulfillmentTime: {
            targetHours: body.metrics.fulfilled_at.target_hours,
            maxHours: body.metrics.fulfilled_at.max_hours,
          },
          cancellationRate: {
            targetPercentage: body.metrics.cancellation_rate.target_percentage,
            maxPercentage: body.metrics.cancellation_rate.max_percentage,
          },
          disputeRate: {
            targetPercentage: body.metrics.dispute_rate.target_percentage,
            maxPercentage: body.metrics.dispute_rate.max_percentage,
          },
        },
        thresholds: {
          warning: {
            fulfillmentTimeHours: body.thresholds.warning.fulfillment_time_hours,
            cancellationRatePercentage: body.thresholds.warning.cancellation_rate_percentage,
            disputeRatePercentage: body.thresholds.warning.dispute_rate_percentage,
          },
          violation: {
            fulfillmentTimeHours: body.thresholds.violation.fulfillment_time_hours,
            cancellationRatePercentage: body.thresholds.violation.cancellation_rate_percentage,
            disputeRatePercentage: body.thresholds.violation.dispute_rate_percentage,
          },
        },
        penalties: {
          fulfillmentTimeViolation: {
            type: body.penalties.fulfillment_time_violation.type,
            valueCents: body.penalties.fulfillment_time_violation.valueCents,
            redirectTo: body.penalties.fulfillment_time_violation.redirect_to,
          },
          cancellationRateViolation: {
            type: body.penalties.cancellation_rate_violation.type,
            valueCents: body.penalties.cancellation_rate_violation.valueCents,
            redirectTo: body.penalties.cancellation_rate_violation.redirect_to,
          },
          disputeRateViolation: {
            type: body.penalties.dispute_rate_violation.type,
            valueCents: body.penalties.dispute_rate_violation.valueCents,
            redirectTo: body.penalties.dispute_rate_violation.redirect_to,
          },
        },
      };
      const sla = marketplaceService.createSLAContract(input);
      marketplaceLogger.api('SLA contract criado', { slaId: sla.slaId });
      return reply.status(201).send(sla);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao criar SLA contract', error);
      return reply.status(400).send({ error: error.message || 'Erro ao criar contrato de SLA' });
    }
  });

  // GET /marketplace/sla-contracts/:slaId
  fastify.get<{ Params: { slaId: string } }>('/sla-contracts/:slaId', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { slaId } = req.params;
      const sla = marketplaceService.getSLAContract(slaId);
      
      if (!sla) {
        return reply.status(404).send({ error: 'SLA contract não encontrado' });
      }

      return reply.status(200).send(sla);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar SLA contract', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar contrato de SLA' });
    }
  });

  // POST /marketplace/reputation-snapshots/generate
  fastify.post<{
    Body: {
      actor_id: string;
      actor_type: 'store' | 'hub' | 'industry' | 'service_provider';
      year: number;
      month: number;
    };
  }>('/reputation-snapshots/generate', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const snapshot = marketplaceService.generateReputationSnapshot(
        req.body.actor_id,
        req.body.actor_type,
        req.body.year,
        req.body.month
      );
      marketplaceLogger.api('Reputation snapshot gerado', { snapshot_id: snapshot.snapshotId });
      return reply.status(201).send(snapshot);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao gerar reputation snapshot', error);
      return reply.status(400).send({ error: error.message || 'Erro ao gerar snapshot de reputação' });
    }
  });

  // GET /marketplace/reputation-snapshots/:actorId
  fastify.get<{ Params: { actorId: string } }>('/reputation-snapshots/:actorId', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { actorId } = req.params;
      const snapshots = marketplaceService.getReputationSnapshots(actorId);
      return reply.status(200).send({ snapshots });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar reputation snapshots', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar snapshots' });
    }
  });

  // POST /marketplace/payment-plan/:paymentPlanId/apply-sla-penalties
  fastify.post<{ Params: { paymentPlanId: string } }>('/payment-plan/:paymentPlanId/apply-sla-penalties', {
    preHandler: requirePermission('marketplace_execute_payments'),
  }, async (req, reply) => {
    try {
      const { paymentPlanId } = req.params;
      const paymentPlan = marketplaceService.applySLAPenaltiesToPaymentPlan(paymentPlanId);
      marketplaceLogger.api('SLA penalties aplicadas', { payment_plan_id: paymentPlanId });
      return reply.status(200).send(paymentPlan);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao aplicar SLA penalties', error);
      return reply.status(400).send({ error: error.message || 'Erro ao aplicar penalidades de SLA' });
    }
  });

  // POST /marketplace/disputes
  fastify.post<{
    Body: {
      order_id: string;
      checkout_id?: string;
      actor_involved: {
        actor_id: string;
        actor_type: 'store' | 'hub' | 'industry' | 'service_provider' | 'customer';
        role: 'seller' | 'fulfillment' | 'buyer' | 'platform';
      };
      type: 'delivery' | 'quality' | 'payment' | 'cancellation' | 'other';
      description: string;
    };
  }>('/disputes', {
    preHandler: requirePermission('marketplace_manage_orders'),
  }, async (req, reply) => {
    try {
      const body = req.body;
      const input = {
        orderId: body.order_id,
        checkoutId: body.checkout_id,
        actorInvolved: {
          actorId: body.actor_involved.actor_id,
          actorType: body.actor_involved.actor_type,
          role: body.actor_involved.role,
        },
        type: body.type,
        description: body.description,
      };
      const dispute = marketplaceService.createDisputeCase(input);
      marketplaceLogger.api('Dispute case criado', { dispute_id: dispute.disputeId });
      return reply.status(201).send(dispute);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao criar dispute case', error);
      return reply.status(400).send({ error: error.message || 'Erro ao criar caso de disputa' });
    }
  });

  // POST /marketplace/disputes/:disputeId/resolve
  fastify.post<{
    Params: { disputeId: string };
    Body: {
      resolution_type: 'refund' | 'partial_refund' | 'replacement' | 'credit' | 'dismissed';
      amountCents: number;
      currency?: string;
      resolved_by: string;
      notes?: string;
    };
  }>('/disputes/:disputeId/resolve', {
    preHandler: requirePermission('marketplace_manage_orders'),
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const { disputeId } = req.params;
      const dispute = await marketplaceService.resolveDisputeCase(tenantId, disputeId, req.body);
      marketplaceLogger.api('Dispute case resolvido', { dispute_id: disputeId });
      return reply.status(200).send(dispute);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao resolver dispute case', error);
      return reply.status(400).send({ error: error.message || 'Erro ao resolver caso de disputa' });
    }
  });

  // GET /marketplace/disputes/:disputeId
  fastify.get<{ Params: { disputeId: string } }>('/disputes/:disputeId', {
    preHandler: requirePermission('marketplace_manage_orders'),
  }, async (req, reply) => {
    try {
      const { disputeId } = req.params;
      const dispute = marketplaceService.getDisputeCase(disputeId);
      
      if (!dispute) {
        return reply.status(404).send({ error: 'Dispute case não encontrado' });
      }

      return reply.status(200).send(dispute);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar dispute case', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar caso de disputa' });
    }
  });

  // GET /marketplace/disputes/order/:orderId
  fastify.get<{ Params: { orderId: string } }>('/disputes/order/:orderId', {
    preHandler: requirePermission('marketplace_manage_orders'),
  }, async (req, reply) => {
    try {
      const { orderId } = req.params;
      const disputes = marketplaceService.getDisputesByOrder(orderId);
      return reply.status(200).send({ disputes });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar disputes do pedido', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar disputas' });
    }
  });

  // ============================================================
  // TRUST LAYER E IDENTIDADE ECONÔMICA
  // ============================================================

  // POST /marketplace/economic-identities (FASE X — backing real)
  fastify.post<{
    Body: {
      actor_type: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
      actor_id: string;
      verified_assets?: {
        documents_verified?: boolean;
        bank_account_verified?: boolean;
        company_verified?: boolean;
      };
    };
  }>('/economic-identities', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(401).send({ error: 'Tenant required' });
    }
    const tenantId = req.tenant.id;
    try {
      const identity = await economicIdentityService.createEconomicIdentity(tenantId, {
        actorId: req.body.actor_id,
        actorType: req.body.actor_type,
        verified_assets: req.body.verified_assets,
      });
      marketplaceLogger.api('Economic identity criada', { identity_id: identity.economicIdentityId });
      return reply.status(201).send(identity);
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao criar economic identity', error);
      const message = error instanceof Error ? error.message : 'Erro ao criar identidade econômica';
      return reply.status(400).send({ error: message });
    }
  });

  // GET /marketplace/economic-identities/:actorId (FASE X — backing real)
  fastify.get<{ Params: { actorId: string } }>('/economic-identities/:actorId', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(401).send({ error: 'Tenant required' });
    }
    const tenantId = req.tenant.id;
    const { actorId } = req.params;
    try {
      const identity = await economicIdentityService.getEconomicIdentity(tenantId, actorId);
      if (!identity) {
        return reply.status(404).send({ error: 'Identidade econômica não encontrada' });
      }
      return reply.status(200).send(identity);
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao buscar economic identity', error);
      const message = error instanceof Error ? error.message : 'Erro ao buscar identidade econômica';
      return reply.status(400).send({ error: message });
    }
  });

  // POST /marketplace/economic-identities/:actorId/recalculate (FASE X — backing real)
  fastify.post<{ Params: { actorId: string } }>('/economic-identities/:actorId/recalculate', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(401).send({ error: 'Tenant required' });
    }
    const tenantId = req.tenant.id;
    const { actorId } = req.params;
    try {
      const identity = await economicIdentityService.recalculateTrustScore(tenantId, actorId);
      if (!identity) {
        return reply.status(404).send({ error: 'Identidade econômica não encontrada' });
      }
      marketplaceLogger.api('Trust level recalculado', { actor_id: actorId });
      return reply.status(200).send(identity);
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao recalcular trust level', error);
      const message = error instanceof Error ? error.message : 'Erro ao recalcular trust level';
      return reply.status(400).send({ error: message });
    }
  });

  // GET /marketplace/trust-events/:actorId
  fastify.get<{ Params: { actorId: string } }>('/trust-events/:actorId', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const { actorId } = req.params;
      const events = await trustEngineService.listTrustEvents(tenantId, { actorId });
      return reply.status(200).send({ events });
    } catch (error: unknown) {
      marketplaceLogger.error('Erro ao buscar trust events', error);
      const message = error instanceof Error ? error.message : 'Erro ao buscar eventos de trust';
      return reply.status(400).send({ error: message });
    }
  });

  // ============================================================
  // MÉTRICAS DE IMPACTO REGIONAL
  // ============================================================

  // POST /marketplace/regional-impact/generate
  fastify.post<{
    Body: {
      region: { country: string; state: string; city: string };
      year: number;
      month: number;
    };
  }>('/regional-impact/generate', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { region, year, month } = req.body;
      const regionId = `${region.country}-${region.state}-${region.city}`;
      const monthStr = String(month).padStart(2, '0');
      const lastDay = new Date(year, month, 0).getDate();
      const period = { start: `${year}-${monthStr}-01`, end: `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}` };
      const snapshot = marketplaceService.generateRegionalCapacitySnapshot(regionId, period, 'monthly');
      marketplaceLogger.api('Snapshot de impacto regional gerado', {
        snapshot_id: snapshot.snapshotId,
        region: `${region.city}, ${region.state}`,
      });
      return reply.status(201).send(snapshot);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao gerar snapshot de impacto regional', error);
      return reply.status(400).send({ error: error.message || 'Erro ao gerar snapshot' });
    }
  });

  // GET /marketplace/regional-impact/snapshots
  fastify.get<{
    Querystring: { country: string; state: string; city: string };
  }>('/regional-impact/snapshots', {
    // Rota pública - métricas são observabilidade pública
  }, async (req, reply) => {
    try {
      const { country, state, city } = req.query;
      if (!country || !state || !city) {
        return reply.status(400).send({ error: 'Região é obrigatória (country, state, city)' });
      }

      const snapshots = marketplaceService.listRegionalCapacitySnapshots({ regionId: `${country}-${state}-${city}` });
      return reply.status(200).send({ snapshots });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar snapshots de impacto regional', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar snapshots' });
    }
  });

  // GET /marketplace/regional-impact/latest
  fastify.get<{
    Querystring: { country: string; state: string; city: string };
  }>('/regional-impact/latest', {
    // Requer tenant para escopo do snapshot
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const { country, state, city } = req.query;
      if (!country || !state || !city) {
        return reply.status(400).send({ error: 'Região é obrigatória (country, state, city)' });
      }

      const snapshot = await regionalImpactService.getLatestRegionalImpact(tenantId, { country, state, city });
      if (!snapshot) {
        return reply.status(404).send({ error: 'Nenhum snapshot encontrado para esta região' });
      }

      return reply.status(200).send(snapshot);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar snapshot mais recente', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar snapshot' });
    }
  });

  // ============================================================
  // EXPANSÃO AUTOMÁTICA E ATIVAÇÃO REGIONAL
  // ============================================================

  // GET /marketplace/regional-activations/history
  fastify.get<{
    Querystring: { country: string; state: string; city: string };
  }>('/regional-activations/history', {
    // Requer tenant para histórico persistido por tenant
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const { country, state, city } = req.query;
      if (!country || !state || !city) {
        return reply.status(400).send({ error: 'Região é obrigatória (country, state, city)' });
      }

      const history = await regionalActivationEventsService.getRegionalActivationHistory(tenantId, { country, state, city });
      return reply.status(200).send({ activations: history });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar histórico de ativações', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar histórico' });
    }
  });

  // GET /marketplace/regional-activations/status
  fastify.get<{
    Querystring: { country: string; state: string; city: string };
  }>('/regional-activations/status', {
    // Requer tenant para regras regionais persistidas
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const { country, state, city } = req.query;
      if (!country || !state || !city) {
        return reply.status(400).send({ error: 'Região é obrigatória (country, state, city)' });
      }

      const region = { country, state, city };
      const [hub_suggested, incentive_unlocked, industry_onboarding_enabled] = await Promise.all([
        regionalActivationService.isHubSuggested(tenantId, region),
        regionalActivationService.getUnlockedIncentive(tenantId, region),
        regionalActivationService.isIndustryOnboardingEnabled(tenantId, region),
      ]);
      const status = {
        hub_suggested,
        incentive_unlocked,
        industry_onboarding_enabled,
      };

      return reply.status(200).send(status);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar status de ativações', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar status' });
    }
  });

  // ============================================================
  // INCENTIVOS ECONÔMICOS DIRECIONADOS
  // ============================================================

  // POST /marketplace/incentives/rules
  fastify.post<{
    Body: {
      region: { country: string; state: string; city: string };
      incentive_type: 'delivery' | 'onboarding' | 'service' | 'logistics';
      max_amount: number;
      max_per_actor: number;
      max_per_period: number;
      requires_trust_level: 'L2' | 'L3' | 'L4' | 'L5';
    };
  }>('/incentives/rules', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const body = req.body;
      const input = {
        tenantId,
        region: body.region,
        incentiveType: body.incentive_type,
        maxAmountCents: body.max_amount,
        maxPerActor: body.max_per_actor,
        maxPerPeriod: body.max_per_period,
        requiresTrustLevel: body.requires_trust_level,
      };
      const rule = await marketplaceService.createIncentiveRule(input);
      marketplaceLogger.api('Regra de incentivo criada', { ruleId: rule.ruleId });
      return reply.status(201).send(rule);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao criar regra de incentivo', error);
      return reply.status(400).send({ error: error.message || 'Erro ao criar regra' });
    }
  });

  // POST /marketplace/incentives/grant
  fastify.post<{
    Body: {
      rule_id: string;
      actor_id: string;
      actor_type: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
      amountCents: number;
      reference: {
        order_id?: string;
        delivery_id?: string;
        subscription_id?: string;
        onboarding_id?: string;
      };
    };
  }>('/incentives/grant', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const body = req.body;
      const input = {
        ruleId: body.rule_id,
        actorId: body.actor_id,
        actorType: body.actor_type,
        amountCents: body.amountCents,
        reference: body.reference,
      };
      const grant = await marketplaceService.grantIncentive(tenantId, input);
      marketplaceLogger.api('Incentivo concedido', { grant_id: grant.grantId });
      return reply.status(201).send(grant);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao conceder incentivo', error);
      return reply.status(400).send({ error: error.message || 'Erro ao conceder incentivo' });
    }
  });

  // POST /marketplace/incentives/:grantId/consume
  fastify.post<{ Params: { grantId: string } }>('/incentives/:grantId/consume', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const { grantId } = req.params;
      await marketplaceService.consumeIncentive(tenantId, grantId);
      marketplaceLogger.api('Incentivo consumido', { grant_id: grantId });
      return reply.status(200).send({ message: 'Incentivo consumido com sucesso' });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao consumir incentivo', error);
      return reply.status(400).send({ error: error.message || 'Erro ao consumir incentivo' });
    }
  });

  // GET /marketplace/incentives/available
  fastify.get<{
    Querystring: { actor_id: string; country: string; state: string; city: string };
  }>('/incentives/available', {
    // Rota pública - incentivos disponíveis são observabilidade pública
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const { actor_id, country, state, city } = req.query;
      if (!actor_id || !country || !state || !city) {
        return reply.status(400).send({ error: 'Parâmetros obrigatórios: actor_id, country, state, city' });
      }
      const incentives = await marketplaceService.getAvailableIncentives(tenantId, actor_id, { country, state, city });
      return reply.status(200).send({ incentives });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar incentivos disponíveis', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar incentivos' });
    }
  });

  // ============================================================
  // SISTEMA DE CONTRATOS COMERCIAIS B2B ENTRE ATORES
  // ============================================================

  // POST /marketplace/b2b-contracts
  fastify.post<{
    Body: {
      supplier_id: string;
      supplier_type: 'store' | 'hub' | 'industry';
      buyer_id: string;
      buyer_type: 'store' | 'hub';
      region: { country: string; state: string; city: string };
      products: Array<{
        product_id: string;
        name: string;
        unit_price: number;
        currency: string;
        minimum_quantity: number;
        maximum_quantity?: number;
      }>;
      terms: {
        volume_commitment: number;
        delivery_schedule: 'weekly' | 'monthly' | 'quarterly';
        payment_terms: 'net_15' | 'net_30' | 'net_60' | 'prepaid';
        penalty_rate?: number;
      };
      starts_at: string;
      ends_at: string;
    };
  }>('/b2b-contracts', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const body = req.body;
      const contract = await marketplaceService.createB2BContract(tenantId, {
        supplierId: body.supplier_id,
        supplierType: body.supplier_type,
        buyerId: body.buyer_id,
        buyerType: body.buyer_type,
        region: body.region,
        products: body.products.map((p: { product_id: string; name: string; unit_price: number; currency: string; minimum_quantity: number; maximum_quantity?: number }) => ({
          productId: p.product_id,
          name: p.name,
          unitPrice: p.unit_price,
          currency: p.currency,
          minimumQuantity: p.minimum_quantity,
          maximumQuantity: p.maximum_quantity,
        })),
        terms: {
          volumeCommitment: body.terms.volume_commitment,
          deliverySchedule: body.terms.delivery_schedule,
          paymentTerms: body.terms.payment_terms,
          penaltyRate: body.terms.penalty_rate,
        },
        startDate: body.starts_at,
        endDate: body.ends_at,
      });
      marketplaceLogger.api('Contrato B2B criado', { contractId: contract.contractId });
      return reply.status(201).send(contract);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao criar contrato B2B', error);
      return reply.status(400).send({ error: error.message || 'Erro ao criar contrato' });
    }
  });

  // POST /marketplace/b2b-contracts/:contractId/sign
  fastify.post<{ Params: { contractId: string } }>('/b2b-contracts/:contractId/sign', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { contractId } = req.params;
      const contract = marketplaceService.signB2BContract(contractId);
      marketplaceLogger.api('Contrato B2B assinado', { contractId });
      return reply.status(200).send(contract);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao assinar contrato B2B', error);
      return reply.status(400).send({ error: error.message || 'Erro ao assinar contrato' });
    }
  });

  // POST /marketplace/b2b-contracts/:contractId/execute
  fastify.post<{
    Params: { contractId: string };
    Body: {
      products: Array<{
        product_id: string;
        quantity: number;
      }>;
      delivered_at: string;
    };
  }>('/b2b-contracts/:contractId/execute', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { contractId } = req.params;
      const body = req.body;
      const execution = marketplaceService.executeB2BContract({
        contractId,
        products: body.products.map((p: { product_id: string; quantity: number }) => ({
          productId: p.product_id,
          quantity: p.quantity,
        })),
        deliveredAt: body.delivered_at,
      });
      marketplaceLogger.api('Contrato B2B executado', {
        executionId: execution.executionId,
        contractId,
      });
      return reply.status(201).send(execution);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao executar contrato B2B', error);
      return reply.status(400).send({ error: error.message || 'Erro ao executar contrato' });
    }
  });

  // GET /marketplace/b2b-contracts/actor/:actorId
  fastify.get<{
    Params: { actorId: string };
    Querystring: { role: 'supplier' | 'buyer' };
  }>('/b2b-contracts/actor/:actorId', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { actorId } = req.params;
      const { role } = req.query;
      if (!role || (role !== 'supplier' && role !== 'buyer')) {
        return reply.status(400).send({ error: 'Role deve ser "supplier" ou "buyer"' });
      }
      const contracts = marketplaceService.getB2BContractsByActor(actorId, role);
      return reply.status(200).send({ contracts });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar contratos B2B', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar contratos' });
    }
  });

  // GET /marketplace/b2b-contracts/:contractId/executions
  fastify.get<{ Params: { contractId: string } }>('/b2b-contracts/:contractId/executions', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { contractId } = req.params;
      const executions = marketplaceService.getB2BContractExecutions(contractId);
      return reply.status(200).send({ executions });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar execuções de contrato B2B', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar execuções' });
    }
  });

  // ============================================================
  // SISTEMA DE CONSCIÊNCIA DE CUSTO E SUSTENTABILIDADE ECONÔMICA
  // ============================================================

  // POST /marketplace/economic-cost-profile
  fastify.post<{
    Body: {
      actor_id: string;
      actor_type: 'store' | 'service_provider';
      period: { year: number; month: number };
      fixed_costs: {
        rent?: number;
        utilities?: number;
        internet?: number;
        salaries?: number;
        taxes?: number;
        other?: number;
      };
      variable_costs: Array<{
        product_id?: string;
        service_id?: string;
        cost_per_unit: number;
        currency: string;
      }>;
      declared_volume_expectation?: number;
    };
  }>('/economic-cost-profile', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const body = req.body;
      const input = {
        actorId: body.actor_id,
        actorType: body.actor_type,
        period: body.period,
        fixed_costs: body.fixed_costs,
        variable_costs: body.variable_costs,
        declared_volume_expectation: body.declared_volume_expectation,
      };
      const profile = marketplaceService.createLegacyOperationalCostProfile(input);
      marketplaceLogger.api('Perfil de custo operacional criado', { profile_id: profile.profile_id });
      return reply.status(201).send(profile);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao criar perfil de custo operacional', error);
      return reply.status(400).send({ error: error.message || 'Erro ao criar perfil' });
    }
  });

  // GET /marketplace/economic-cost-profile/:actorId
  fastify.get<{
    Params: { actorId: string };
    Querystring: { year: number; month: number };
  }>('/economic-cost-profile/:actorId', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { actorId } = req.params;
      const { year, month } = req.query;
      if (!year || !month) {
        return reply.status(400).send({ error: 'Parâmetros obrigatórios: year, month' });
      }

      const profile = marketplaceService.getLegacyOperationalCostProfile(actorId, {
        year: parseInt(year.toString(), 10),
        month: parseInt(month.toString(), 10),
      });

      if (!profile) {
        return reply.status(404).send({ error: 'Perfil de custo não encontrado' });
      }

      return reply.status(200).send(profile);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar perfil de custo operacional', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar perfil' });
    }
  });

  // POST /marketplace/economic-sustainability/generate
  fastify.post<{
    Body: {
      actor_id: string;
      period: { year: number; month: number };
    };
  }>('/economic-sustainability/generate', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { actor_id, period } = req.body;
      const snapshot = marketplaceService.generateEconomicSustainabilitySnapshot(actor_id, period);
      marketplaceLogger.api('Snapshot de sustentabilidade econômica gerado', {
        snapshot_id: snapshot.snapshotId,
        actor_id,
      });
      return reply.status(201).send(snapshot);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao gerar snapshot de sustentabilidade', error);
      return reply.status(400).send({ error: error.message || 'Erro ao gerar snapshot' });
    }
  });

  // GET /marketplace/economic-sustainability/:actorId
  fastify.get<{ Params: { actorId: string } }>('/economic-sustainability/:actorId', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { actorId } = req.params;
      const snapshot = marketplaceService.getLatestEconomicSustainabilitySnapshot(actorId);
      if (!snapshot) {
        return reply.status(404).send({ error: 'Snapshot de sustentabilidade não encontrado' });
      }
      return reply.status(200).send(snapshot);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar snapshot de sustentabilidade', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar snapshot' });
    }
  });

  // GET /marketplace/economic-sustainability/:actorId/history
  fastify.get<{ Params: { actorId: string } }>('/economic-sustainability/:actorId/history', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { actorId } = req.params;
      const snapshots = marketplaceService.getEconomicSustainabilitySnapshots(actorId);
      return reply.status(200).send({ snapshots });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar histórico de sustentabilidade', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar histórico' });
    }
  });

  // ============================================================
  // COMPRA COLETIVA PROGRAMADA E LOTES DE PRODUÇÃO COMPROMETIDOS
  // ============================================================

  // POST /marketplace/production-batches
  fastify.post<{
    Body: {
      industry_id: string;
      product_id: string;
      min_quantity: number;
      max_quantity?: number;
      unit_price: { amountCents: number; currency: string };
      commit_deadline: string;
      regions_allowed: Array<{ country: string; state: string; city: string }>;
    };
  }>('/production-batches', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const pb = req.body as Record<string, unknown>;
      const batch = marketplaceService.createProductionBatch({
        industryId: pb.industry_id as string,
        productId: pb.product_id as string,
        minQuantity: (pb.min_quantity as number) ?? 0,
        maxQuantity: pb.max_quantity as number | undefined,
        unitPrice: pb.unit_price as { amountCents: number; currency: string },
        commitDeadline: pb.commit_deadline as string,
        regionsAllowed: (pb.regions_allowed as Array<{ country: string; state: string; city: string }>) ?? [],
      });
      marketplaceLogger.api('Lote de produção programado criado', { batch_id: batch.batchId });
      return reply.status(201).send(batch);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao criar lote de produção', error);
      return reply.status(400).send({ error: error.message || 'Erro ao criar lote' });
    }
  });

  // GET /marketplace/production-batches/open
  fastify.get<{
    Querystring: { country: string; state: string; city: string };
  }>('/production-batches/open', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { country, state, city } = req.query;
      if (!country || !state || !city) {
        return reply.status(400).send({ error: 'Região é obrigatória (country, state, city)' });
      }

      const batches = marketplaceService.getOpenBatches({ country, state, city });
      return reply.status(200).send({ batches });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar lotes abertos', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar lotes' });
    }
  });

  // GET /marketplace/production-batches/:batchId
  fastify.get<{ Params: { batchId: string } }>('/production-batches/:batchId', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { batchId } = req.params;
      const batch = marketplaceService.getProductionBatch(batchId);
      if (!batch) {
        return reply.status(404).send({ error: 'Lote não encontrado' });
      }
      return reply.status(200).send(batch);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar lote', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar lote' });
    }
  });

  // POST /marketplace/production-batches/:batchId/commit
  fastify.post<{
    Params: { batchId: string };
    Body: {
      actor_id: string;
      actor_type: 'user' | 'store' | 'hub';
      quantity: number;
    };
  }>('/production-batches/:batchId/commit', {
    // Rota pública (qualquer um pode fazer compromisso)
  }, async (req, reply) => {
    try {
      const { batchId } = req.params;
      const body = req.body;
      const input = {
        batchId,
        actorId: body.actor_id,
        actorType: body.actor_type,
        quantity: body.quantity,
      };
      const commitment = marketplaceService.commitToBatch(input);
      marketplaceLogger.api('Compromisso de compra em lote criado', {
        commitment_id: commitment.commitmentId,
      });
      return reply.status(201).send(commitment);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao fazer compromisso em lote', error);
      return reply.status(400).send({ error: error.message || 'Erro ao fazer compromisso' });
    }
  });

  // POST /marketplace/production-batches/:batchId/commitments/:commitmentId/cancel
  fastify.post<{ Params: { batchId: string; commitmentId: string } }>(
    '/production-batches/:batchId/commitments/:commitmentId/cancel',
    {
      // Rota pública
    },
    async (req, reply) => {
      try {
        const { commitmentId } = req.params;
        const commitment = marketplaceService.cancelCommitment(commitmentId);
        marketplaceLogger.api('Compromisso de compra em lote cancelado', {
          commitment_id: commitmentId,
        });
        return reply.status(200).send(commitment);
      } catch (error: any) {
        marketplaceLogger.error('Erro ao cancelar compromisso', error);
        return reply.status(400).send({ error: error.message || 'Erro ao cancelar compromisso' });
      }
    }
  );

  // GET /marketplace/production-batches/:batchId/commitments
  fastify.get<{ Params: { batchId: string } }>('/production-batches/:batchId/commitments', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { batchId } = req.params;
      const commitments = marketplaceService.getBatchCommitments(batchId);
      return reply.status(200).send({ commitments });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar compromissos do lote', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar compromissos' });
    }
  });

  // POST /marketplace/production-batches/:batchId/evaluate
  fastify.post<{ Params: { batchId: string } }>('/production-batches/:batchId/evaluate', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { batchId } = req.params;
      const batch = marketplaceService.evaluateBatchAtDeadline(batchId);
      marketplaceLogger.api('Lote de produção avaliado', { batch_id: batchId, status: batch.status });
      return reply.status(200).send(batch);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao avaliar lote', error);
      return reply.status(400).send({ error: error.message || 'Erro ao avaliar lote' });
    }
  });

  // POST /marketplace/production-batches/:batchId/convert
  fastify.post<{ Params: { batchId: string } }>('/production-batches/:batchId/convert', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { batchId } = req.params;
      const orders = marketplaceService.convertBatchToOrders(batchId);
      marketplaceLogger.api('Lote convertido em Orders', {
        batch_id: batchId,
        orders_count: orders.length,
      });
      return reply.status(200).send({ orders });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao converter lote em orders', error);
      return reply.status(400).send({ error: error.message || 'Erro ao converter lote' });
    }
  });

  // GET /marketplace/production-batches/actor/:actorId/commitments
  fastify.get<{ Params: { actorId: string } }>('/production-batches/actor/:actorId/commitments', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { actorId } = req.params;
      const commitments = marketplaceService.getActorCommitments(actorId);
      return reply.status(200).send({ commitments });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar compromissos do ator', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar compromissos' });
    }
  });

  // ============================================================
  // ONBOARDING UNIFICADO DE EMPRESAS + CONEXÃO AUTOMÁTICA
  // ============================================================

  // GET /marketplace/company-plans
  fastify.get('/company-plans', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const plans = marketplaceService.getAllCompanyPlans();
      return reply.status(200).send({ plans });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar planos de empresa', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar planos' });
    }
  });

  // GET /marketplace/company-plans/:planId
  fastify.get<{ Params: { planId: string } }>('/company-plans/:planId', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { planId } = req.params;
      const plan = marketplaceService.getCompanyPlan(planId);
      if (!plan) {
        return reply.status(404).send({ error: 'Plano não encontrado' });
      }
      return reply.status(200).send(plan);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar plano', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar plano' });
    }
  });

  // POST /marketplace/company-onboarding
  fastify.post<{
    Body: {
      company_type: 'cnpj' | 'cpf' | 'mei';
      company_name: string;
      document: string;
      category: 'product' | 'service' | 'industry' | 'hub' | 'hybrid';
      region: {
        country: string;
        state: string;
        city: string;
        neighborhood?: string;
      };
      documents: {
        cnpj?: string;
        qsa_document?: string;
        last_contractual_change?: string;
        address_proof?: string;
      };
      bank_account: {
        type: 'unifibank' | 'external';
        account_id?: string;
        external_bank_name?: string;
        external_account_number?: string;
        isVerified: boolean;
      };
      marketplace_enabled: boolean;
      services_enabled: boolean;
      products_enabled: boolean;
      pdv_enabled: boolean;
      payment_infrastructure: {
        accept_unificard: boolean;
        accept_external_gateway: boolean;
        external_gateway_provider?: string;
      };
      payment_terminal_requested: boolean;
      payment_terminal_type?: 'unified_card' | 'external';
      payment_terminal_provider?: string;
      plan_id?: string;
    };
  }>('/company-onboarding', {
    // Rota pública (qualquer um pode criar empresa)
  }, async (req, reply) => {
    try {
      const body = req.body;
      const onboarding = marketplaceService.createCompanyOnboarding({
        companyType: body.company_type,
        companyName: body.company_name,
        document: body.document,
        category: body.category,
        region: body.region,
        documents: {
          cnpj: body.documents?.cnpj,
          qsaDocument: body.documents?.qsa_document,
          lastContractualChange: body.documents?.last_contractual_change,
          addressProof: body.documents?.address_proof,
        },
        bankAccount: {
          type: body.bank_account.type,
          accountId: body.bank_account.account_id,
          externalBankName: body.bank_account.external_bank_name,
          externalAccountNumber: body.bank_account.external_account_number,
          isVerified: body.bank_account.isVerified ?? (body.bank_account as { verified?: boolean }).verified ?? false,
        },
        marketplaceEnabled: body.marketplace_enabled,
        servicesEnabled: body.services_enabled,
        productsEnabled: body.products_enabled,
        pdvEnabled: body.pdv_enabled,
        paymentInfrastructure: {
          acceptUnificard: body.payment_infrastructure.accept_unificard,
          acceptExternalGateway: body.payment_infrastructure.accept_external_gateway,
          externalGatewayProvider: body.payment_infrastructure.external_gateway_provider,
        },
        planId: body.plan_id,
      });
      marketplaceLogger.api('Processo de onboarding de empresa criado', {
        onboardingId: onboarding.onboardingId,
      });
      return reply.status(201).send(onboarding);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao criar onboarding', error);
      return reply.status(400).send({ error: error.message || 'Erro ao criar onboarding' });
    }
  });

  // POST /marketplace/company-onboarding/:onboardingId/complete
  fastify.post<{ Params: { onboardingId: string } }>('/company-onboarding/:onboardingId/complete', {
    // Rota pública
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const { onboardingId } = req.params;
      const onboarding = await marketplaceService.completeCompanyOnboarding(tenantId, onboardingId);
      marketplaceLogger.api('Onboarding de empresa completado', {
        onboardingId,
        companyId: onboarding.companyId,
      });
      return reply.status(200).send(onboarding);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao completar onboarding', error);
      return reply.status(400).send({ error: error.message || 'Erro ao completar onboarding' });
    }
  });

  // GET /marketplace/company-onboarding/:onboardingId
  fastify.get<{ Params: { onboardingId: string } }>('/company-onboarding/:onboardingId', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { onboardingId } = req.params;
      const onboarding = marketplaceService.getCompanyOnboarding(onboardingId);
      if (!onboarding) {
        return reply.status(404).send({ error: 'Onboarding não encontrado' });
      }
      return reply.status(200).send(onboarding);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar onboarding', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar onboarding' });
    }
  });

  // POST /marketplace/payment-terminals/:terminalId/approve
  fastify.post<{ Params: { terminalId: string } }>('/payment-terminals/:terminalId/approve', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      const { terminalId } = req.params;
      const terminal = marketplaceService.approvePaymentTerminal(terminalId);
      marketplaceLogger.api('Maquininha de pagamento aprovada', { terminal_id: terminalId });
      return reply.status(200).send(terminal);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao aprovar maquininha', error);
      return reply.status(400).send({ error: error.message || 'Erro ao aprovar maquininha' });
    }
  });

  // POST /marketplace/payment-terminals/:terminalId/activate
  fastify.post<{ Params: { terminalId: string } }>('/payment-terminals/:terminalId/activate', {
    preHandler: requirePermission('marketplace_manage_catalog'),
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const { terminalId } = req.params;
      const terminal = await marketplaceService.activatePaymentTerminal(tenantId, terminalId);
      marketplaceLogger.api('Maquininha de pagamento ativada', { terminal_id: terminalId });
      return reply.status(200).send(terminal);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao ativar maquininha', error);
      return reply.status(400).send({ error: error.message || 'Erro ao ativar maquininha' });
    }
  });

  // GET /marketplace/payment-terminals/:terminalId
  fastify.get<{ Params: { terminalId: string } }>('/payment-terminals/:terminalId', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { terminalId } = req.params;
      const terminal = marketplaceService.getPaymentTerminal(terminalId);
      if (!terminal) {
        return reply.status(404).send({ error: 'Maquininha não encontrada' });
      }
      return reply.status(200).send(terminal);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar maquininha', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar maquininha' });
    }
  });

  // GET /marketplace/payment-terminals/company/:companyId
  fastify.get<{ Params: { companyId: string } }>('/payment-terminals/company/:companyId', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { companyId } = req.params;
      const terminals = marketplaceService.getCompanyPaymentTerminals(companyId);
      return reply.status(200).send({ terminals });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar maquininhas da empresa', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar maquininhas' });
    }
  });

  // ============================================================
  // TRANSPARÊNCIA FINANCEIRA REGIONAL
  // ============================================================

  // GET /marketplace/regional-financial-flow
  fastify.get<{
    Querystring: { country: string; state: string; city: string; year: number; month: number };
  }>('/regional-financial-flow', {
    // Rota pública (transparência total)
  }, async (req, reply) => {
    try {
      const { country, state, city, year, month } = req.query;
      if (!country || !state || !city || !year || !month) {
        return reply.status(400).send({
          error: 'Parâmetros obrigatórios: country, state, city, year, month',
        });
      }
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const flow = await marketplaceService.getRegionalFinancialFlow(
        tenantId,
        { country, state, city },
        {
          year: parseInt(year.toString(), 10),
          month: parseInt(month.toString(), 10),
        }
      );

      return reply.status(200).send(flow);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar fluxo financeiro regional', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar fluxo financeiro' });
    }
  });

  // ============================================================
  // ORQUESTRADOR DE DEMANDA DE SERVIÇOS (AGORA / AGENDADO / COMBO)
  // ============================================================

  // POST /marketplace/services/requests
  fastify.post<{
    Body: {
      requester_actor_id: string;
      city: string;
      neighborhood?: string;
      intent: 'now' | 'scheduled' | 'bundle';
      service_items: Array<{ offering_id: string; quantity: number }>;
      schedule: {
        mode: 'now' | 'scheduled';
        max_wait_minutes?: number;
        date?: string;
        time_window_minutes?: number;
      };
      constraints: {
        provider_radius_mode: 'same_neighborhood' | 'same_city';
        min_trust_level_required: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
        allow_multiple_providers: boolean;
      };
    };
  }>('/services/requests', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const body = req.body;
      const sched = body.schedule as Record<string, unknown> | undefined;
      const constraints = body.constraints as Record<string, unknown> | undefined;
      const input = {
        requesterActorId: body.requester_actor_id,
        city: body.city,
        neighborhood: body.neighborhood,
        intent: body.intent,
        serviceItems: body.service_items.map((i: { offering_id: string; quantity: number }) => ({
          offeringId: i.offering_id,
          quantity: i.quantity,
        })),
        schedule: {
          mode: sched?.mode as 'now' | 'scheduled',
          maxWaitMinutes: sched?.max_wait_minutes as number | undefined,
          date: sched?.date as string | undefined,
          timeWindowMinutes: sched?.time_window_minutes as number | undefined,
        },
        constraints: {
          providerRadiusMode: constraints?.provider_radius_mode as 'same_neighborhood' | 'same_city',
          minTrustLevelRequired: constraints?.min_trust_level_required as 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5',
          allowMultipleProviders: constraints?.allow_multiple_providers as boolean,
        },
      };
      const request = marketplaceService.createServiceRequest(input);
      marketplaceLogger.api('Requisição de serviço criada', { request_id: request.requestId });
      return reply.status(201).send(request);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao criar requisição de serviço', error);
      return reply.status(400).send({ error: error.message || 'Erro ao criar requisição' });
    }
  });

  // GET /marketplace/services/requests/:requestId
  fastify.get<{ Params: { requestId: string } }>('/services/requests/:requestId', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { requestId } = req.params;
      const request = marketplaceService.getServiceRequest(requestId);
      if (!request) {
        return reply.status(404).send({ error: 'Requisição não encontrada' });
      }
      return reply.status(200).send(request);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar requisição', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar requisição' });
    }
  });

  // GET /marketplace/services/providers/eligible
  fastify.get<{
    Querystring: { request_id: string };
  }>('/services/providers/eligible', {
    // Rota pública
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const { request_id } = req.query;
      if (!request_id) {
        return reply.status(400).send({ error: 'request_id é obrigatório' });
      }
      const candidates = await marketplaceService.listEligibleServiceProviders(tenantId, request_id.toString());
      return reply.status(200).send({ candidates });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao listar providers elegíveis', error);
      return reply.status(400).send({ error: error.message || 'Erro ao listar providers' });
    }
  });

  // POST /marketplace/services/requests/:requestId/dispatch
  fastify.post<{ Params: { requestId: string } }>('/services/requests/:requestId/dispatch', {
    // Rota pública
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const { requestId } = req.params;
      const dispatch = await marketplaceService.dispatchServiceRequest(tenantId, requestId);
      marketplaceLogger.api('Dispatch de requisição criado', {
        dispatch_id: dispatch.dispatchId,
        request_id: requestId,
      });
      return reply.status(201).send(dispatch);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao criar dispatch', error);
      return reply.status(400).send({ error: error.message || 'Erro ao criar dispatch' });
    }
  });

  // POST /marketplace/services/dispatch/:dispatchId/accept
  fastify.post<{
    Params: { dispatchId: string };
    Body: { provider_actor_id: string };
  }>('/services/dispatch/:dispatchId/accept', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { dispatchId } = req.params;
      const { provider_actor_id } = req.body;
      const order = marketplaceService.acceptServiceDispatch(dispatchId, provider_actor_id);
      marketplaceLogger.api('Dispatch de serviço aceito', {
        dispatch_id: dispatchId,
        provider_actor_id,
        order_id: order.orderId,
      });
      return reply.status(200).send({ order });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao aceitar dispatch', error);
      return reply.status(400).send({ error: error.message || 'Erro ao aceitar dispatch' });
    }
  });

  // POST /marketplace/services/requests/:requestId/expire
  fastify.post<{ Params: { requestId: string } }>('/services/requests/:requestId/expire', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { requestId } = req.params;
      const request = marketplaceService.expireServiceRequest(requestId);
      marketplaceLogger.api('Requisição de serviço expirada', { request_id: requestId });
      return reply.status(200).send(request);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao expirar requisição', error);
      return reply.status(400).send({ error: error.message || 'Erro ao expirar requisição' });
    }
  });

  // GET /marketplace/services/dispatch/:dispatchId
  fastify.get<{ Params: { dispatchId: string } }>('/services/dispatch/:dispatchId', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { dispatchId } = req.params;
      const dispatch = marketplaceService.getServiceDispatch(dispatchId);
      if (!dispatch) {
        return reply.status(404).send({ error: 'Dispatch não encontrado' });
      }
      return reply.status(200).send(dispatch);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar dispatch', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar dispatch' });
    }
  });

  // ============================================================
  // PRESENCE/ONLINE CANÔNICO PARA PROVIDERS + SLA DE RESPOSTA
  // ============================================================

  // POST /marketplace/providers/:providerActorId/presence
  fastify.post<{
    Params: { providerActorId: string };
    Body: {
      status: 'online' | 'offline';
      region: {
        country: string;
        state: string;
        city: string;
        neighborhood?: string;
      };
    };
  }>('/providers/:providerActorId/presence', {
    // Rota pública (provider atualiza própria presença)
  }, async (req, reply) => {
    try {
      const { providerActorId } = req.params;
      const presence = marketplaceService.updateProviderPresence({
        providerActorId: providerActorId,
        ...req.body,
      });
      marketplaceLogger.api('Presença de provider atualizada', {
        provider_actor_id: providerActorId,
        status: req.body.status,
      });
      return reply.status(200).send(presence);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao atualizar presença de provider', error);
      return reply.status(400).send({ error: error.message || 'Erro ao atualizar presença' });
    }
  });

  // GET /marketplace/providers/:providerActorId/presence
  fastify.get<{ Params: { providerActorId: string } }>('/providers/:providerActorId/presence', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { providerActorId } = req.params;
      const presence = marketplaceService.getProviderPresence(providerActorId);
      if (!presence) {
        return reply.status(404).send({ error: 'Presença de provider não encontrada' });
      }
      return reply.status(200).send(presence);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar presença de provider', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar presença' });
    }
  });

  // GET /marketplace/providers/:providerActorId/sla-metrics
  fastify.get<{ Params: { providerActorId: string } }>('/providers/:providerActorId/sla-metrics', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { providerActorId } = req.params;
      const metrics = marketplaceService.getProviderResponseSLAMetrics(providerActorId);
      if (!metrics) {
        return reply.status(404).send({ error: 'Métricas de SLA não encontradas' });
      }
      return reply.status(200).send(metrics);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar métricas de SLA', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar métricas' });
    }
  });

  // POST /marketplace/services/dispatch/:dispatchId/decline
  fastify.post<{
    Params: { dispatchId: string };
    Body: { provider_actor_id: string };
  }>('/services/dispatch/:dispatchId/decline', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { dispatchId } = req.params;
      const { provider_actor_id } = req.body;

      const dispatch = marketplaceService.getServiceDispatch(dispatchId);
      if (!dispatch) {
        return reply.status(404).send({ error: 'Dispatch não encontrado' });
      }

      // Validar provider é candidato
      const candidate = dispatch.candidates.find(c => c.providerActorId === provider_actor_id);
      if (!candidate) {
        return reply.status(400).send({ error: 'Provider não é candidato deste dispatch' });
      }

      if (dispatch.status !== 'sent') {
        return reply.status(400).send({ error: 'Dispatch não está disponível para recusa' });
      }

      // Registrar resposta a dispatch (recusado)
      marketplaceService.recordDispatchResponse(dispatchId, 'declined');

      // Atualizar dispatch
      marketplaceService.updateServiceDispatch(dispatchId, { status: 'declined' });

      const updatedDispatch = marketplaceService.getServiceDispatch(dispatchId);
      marketplaceLogger.api('Dispatch de serviço recusado', {
        dispatch_id: dispatchId,
        provider_actor_id,
      });

      return reply.status(200).send({ message: 'Dispatch recusado', dispatch: updatedDispatch });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao recusar dispatch', error);
      return reply.status(400).send({ error: error.message || 'Erro ao recusar dispatch' });
    }
  });

  // ============================================================
  // MATCHING ECONÔMICO DE SERVIÇOS + PRÉ-RESERVA INTELIGENTE
  // ============================================================

  // GET /marketplace/services/pre-reservations/:preReservationId
  fastify.get<{ Params: { preReservationId: string } }>('/services/pre-reservations/:preReservationId', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { preReservationId } = req.params;
      const preReservation = marketplaceService.getPreReservation(preReservationId);
      if (!preReservation) {
        return reply.status(404).send({ error: 'Pré-reserva não encontrada' });
      }
      return reply.status(200).send(preReservation);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar pré-reserva', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar pré-reserva' });
    }
  });

  // GET /marketplace/services/dispatch/:dispatchId/pre-reservations
  fastify.get<{ Params: { dispatchId: string } }>('/services/dispatch/:dispatchId/pre-reservations', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { dispatchId } = req.params;
      const preReservations = marketplaceService.getPreReservationsByDispatch(dispatchId);
      return reply.status(200).send({ pre_reservations: preReservations });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar pré-reservas do dispatch', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar pré-reservas' });
    }
  });

  // POST /marketplace/services/pre-reservations/expire
  fastify.post('/services/pre-reservations/expire', {
    // Rota pública (pode ser chamada periodicamente)
  }, async (req, reply) => {
    try {
      marketplaceService.expirePreReservations();
      return reply.status(200).send({ message: 'Pré-reservas expiradas processadas' });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao expirar pré-reservas', error);
      return reply.status(400).send({ error: error.message || 'Erro ao expirar pré-reservas' });
    }
  });

  // ============================================================
  // APP DO PRESTADOR: INBOX DE DISPATCH
  // ============================================================

  // GET /marketplace/providers/:providerActorId/dispatch-inbox
  fastify.get<{ Params: { providerActorId: string } }>('/providers/:providerActorId/dispatch-inbox', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { providerActorId } = req.params;
      const inbox = marketplaceService.getProviderDispatchInbox(providerActorId);
      marketplaceLogger.api('Inbox de dispatch consultada', {
        provider_actor_id: providerActorId,
        dispatches_count: inbox.length,
      });
      return reply.status(200).send({ inbox });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar inbox de dispatch', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar inbox' });
    }
  });

  // GET /marketplace/services/dispatch/:dispatchId/status
  fastify.get<{
    Params: { dispatchId: string };
    Querystring: { provider_id: string };
  }>('/services/dispatch/:dispatchId/status', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { dispatchId } = req.params;
      const { provider_id } = req.query;

      if (!provider_id) {
        return reply.status(400).send({ error: 'provider_id é obrigatório' });
      }

      const status = marketplaceService.getDispatchStatusForProvider(dispatchId, provider_id.toString());
      return reply.status(200).send(status);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar status de dispatch', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar status' });
    }
  });

  // ============================================================
  // APP DO USUÁRIO (DEMANDANTE): TIMELINE DE SERVIÇO
  // ============================================================

  // GET /marketplace/services/requests/:requestId/timeline
  fastify.get<{ Params: { requestId: string } }>('/services/requests/:requestId/timeline', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { requestId } = req.params;
      const timeline = marketplaceService.getServiceRequestTimeline(requestId);
      marketplaceLogger.api('Timeline de serviço consultada', {
        request_id: requestId,
        events_count: timeline.length,
      });
      return reply.status(200).send({ timeline });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar timeline de serviço', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar timeline' });
    }
  });

  // GET /marketplace/services/requests/:requestId/status
  fastify.get<{ Params: { requestId: string } }>('/services/requests/:requestId/status', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { requestId } = req.params;
      const status = marketplaceService.getServiceRequestStatus(requestId);
      return reply.status(200).send(status);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar status de serviço', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar status' });
    }
  });

  // POST /marketplace/services/requests/:requestId/complete
  fastify.post<{
    Params: { requestId: string };
    Body: { completed_by: string };
  }>('/services/requests/:requestId/complete', {
    // Rota pública (provider marca como completo)
  }, async (req, reply) => {
    try {
      const { requestId } = req.params;
      const { completed_by } = req.body;

      if (!completed_by) {
        return reply.status(400).send({ error: 'completed_by é obrigatório' });
      }

      const result = marketplaceService.completeServiceRequest(requestId, completed_by);
      marketplaceLogger.api('Serviço marcado como completo', {
        request_id: requestId,
        completed_by,
      });
      return reply.status(200).send(result);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao marcar serviço como completo', error);
      return reply.status(400).send({ error: error.message || 'Erro ao marcar como completo' });
    }
  });

  // ============================================================
  // PAGAMENTO NO SERVIÇO: ESCROW LIGHT + CONFIRMAÇÃO DUPLA
  // ============================================================

  // GET /marketplace/services/requests/:requestId/payment-hold
  fastify.get<{ Params: { requestId: string } }>('/services/requests/:requestId/payment-hold', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { requestId } = req.params;
      const hold = marketplaceService.getServicePaymentHoldByRequest(requestId);
      if (!hold) {
        return reply.status(404).send({ error: 'Payment hold não encontrado' });
      }
      return reply.status(200).send(hold);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar payment hold', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar payment hold' });
    }
  });

  // POST /marketplace/services/requests/:requestId/confirm-completed (customer)
  fastify.post<{
    Params: { requestId: string };
    Body: { customer_actor_id: string };
  }>('/services/requests/:requestId/confirm-completed', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { requestId } = req.params;
      const { customer_actor_id } = req.body;

      if (!customer_actor_id) {
        return reply.status(400).send({ error: 'customer_actor_id é obrigatório' });
      }

      const result = marketplaceService.confirmServiceCompletedByCustomer(requestId, customer_actor_id);
      marketplaceLogger.api('Serviço confirmado pelo cliente', {
        request_id: requestId,
        customer_actor_id,
      });
      return reply.status(200).send(result);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao confirmar serviço pelo cliente', error);
      return reply.status(400).send({ error: error.message || 'Erro ao confirmar serviço' });
    }
  });

  // POST /marketplace/providers/:providerActorId/services/requests/:requestId/confirm-completed (provider)
  fastify.post<{
    Params: { requestId: string; providerActorId: string };
  }>('/providers/:providerActorId/services/requests/:requestId/confirm-completed', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { requestId, providerActorId } = req.params;
      const result = marketplaceService.confirmServiceCompletedByProvider(requestId, providerActorId);
      marketplaceLogger.api('Serviço confirmado pelo provider', {
        request_id: requestId,
        provider_actor_id: providerActorId,
      });
      return reply.status(200).send(result);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao confirmar serviço pelo provider', error);
      return reply.status(400).send({ error: error.message || 'Erro ao confirmar serviço' });
    }
  });

  // POST /marketplace/services/requests/:requestId/dispute
  fastify.post<{
    Params: { requestId: string };
    Body: {
      actor_id: string;
      role: 'customer' | 'provider';
      reason: 'service_not_done' | 'quality_issue' | 'wrong_service' | 'other';
    };
  }>('/services/requests/:requestId/dispute', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { requestId } = req.params;
      const { actor_id, role, reason } = req.body;

      if (!actor_id || !role || !reason) {
        return reply.status(400).send({ error: 'actor_id, role e reason são obrigatórios' });
      }

      const result = marketplaceService.disputeService(requestId, actor_id, role, reason);
      marketplaceLogger.api('Serviço disputado', {
        request_id: requestId,
        actor_id,
        role,
        reason,
      });
      return reply.status(200).send(result);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao disputar serviço', error);
      return reply.status(400).send({ error: error.message || 'Erro ao disputar serviço' });
    }
  });

  // POST /marketplace/services/payment-holds/expire-check
  fastify.post('/services/payment-holds/expire-check', {
    // Rota pública (pode ser chamada por job/cron)
  }, async (req, reply) => {
    try {
      const result = marketplaceService.expireServicePaymentHolds();
      marketplaceLogger.api('Verificação de expiração de payment holds executada', result);
      return reply.status(200).send(result);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao verificar expiração de payment holds', error);
      return reply.status(400).send({ error: error.message || 'Erro ao verificar expiração' });
    }
  });

  // ============================================================
  // ORÇAMENTO ASSISTIDO + EXECUÇÃO VINCULADA (QUOTE → SERVICE)
  // ============================================================

  // GET /marketplace/services/visits/:visitId
  fastify.get<{ Params: { visitId: string } }>('/services/visits/:visitId', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { visitId } = req.params;
      const visit = marketplaceService.getServiceVisit(visitId);
      if (!visit) {
        return reply.status(404).send({ error: 'Visita não encontrada' });
      }
      return reply.status(200).send(visit);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar visita', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar visita' });
    }
  });

  // GET /marketplace/services/requests/:requestId/visits
  fastify.get<{ Params: { requestId: string } }>('/services/requests/:requestId/visits', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { requestId } = req.params;
      const visits = marketplaceService.getServiceVisitsByRequest(requestId);
      return reply.status(200).send({ visits });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar visitas', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar visitas' });
    }
  });

  // POST /marketplace/services/visits/:visitId/complete
  fastify.post<{ Params: { visitId: string } }>('/services/visits/:visitId/complete', {
    // Rota pública (provider marca visita como completa)
  }, async (req, reply) => {
    try {
      const { visitId } = req.params;
      const visit = marketplaceService.completeServiceVisit(visitId);
      marketplaceLogger.api('Visita marcada como completa', {
        visit_id: visitId,
      });
      return reply.status(200).send(visit);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao marcar visita como completa', error);
      return reply.status(400).send({ error: error.message || 'Erro ao marcar visita como completa' });
    }
  });

  // POST /marketplace/services/quotes
  fastify.post<{
    Body: {
      request_id: string;
      visit_id: string;
      provider_actor_id: string;
      service_value: { amountCents: number; currency: string };
      description: string;
      requires_materials: boolean;
      execution_date?: string;
      execution_time?: string;
    };
  }>('/services/quotes', {
    // Rota pública (provider envia orçamento)
  }, async (req, reply) => {
    try {
      const body = req.body;
      const input = {
        requestId: body.request_id,
        visitId: body.visit_id,
        providerActorId: body.provider_actor_id,
        serviceValue: body.service_value,
        description: body.description,
        requiresMaterials: body.requires_materials,
        executionDate: body.execution_date,
        executionTime: body.execution_time,
      };
      const quote = marketplaceService.createServiceQuote(input);
      marketplaceLogger.api('Orçamento criado', {
        quote_id: quote.quoteId,
        request_id: req.body.request_id,
      });
      return reply.status(200).send(quote);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao criar orçamento', error);
      return reply.status(400).send({ error: error.message || 'Erro ao criar orçamento' });
    }
  });

  // GET /marketplace/services/quotes/:quoteId
  fastify.get<{ Params: { quoteId: string } }>('/services/quotes/:quoteId', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { quoteId } = req.params;
      const quote = marketplaceService.getServiceQuote(quoteId);
      if (!quote) {
        return reply.status(404).send({ error: 'Orçamento não encontrado' });
      }
      return reply.status(200).send(quote);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar orçamento', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar orçamento' });
    }
  });

  // GET /marketplace/services/requests/:requestId/quotes
  fastify.get<{ Params: { requestId: string } }>('/services/requests/:requestId/quotes', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { requestId } = req.params;
      const quotes = marketplaceService.getServiceQuotesByRequest(requestId);
      return reply.status(200).send({ quotes });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar orçamentos', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar orçamentos' });
    }
  });

  // POST /marketplace/services/quotes/:quoteId/accept
  fastify.post<{
    Params: { quoteId: string };
    Body: { customer_actor_id: string };
  }>('/services/quotes/:quoteId/accept', {
    // Rota pública (customer aceita orçamento)
  }, async (req, reply) => {
    try {
      const { quoteId } = req.params;
      const { customer_actor_id } = req.body;

      if (!customer_actor_id) {
        return reply.status(400).send({ error: 'customer_actor_id é obrigatório' });
      }

      const result = marketplaceService.acceptServiceQuote(quoteId, customer_actor_id);
      marketplaceLogger.api('Orçamento aceito', {
        quote_id: quoteId,
        customer_actor_id,
      });
      return reply.status(200).send(result);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao aceitar orçamento', error);
      return reply.status(400).send({ error: error.message || 'Erro ao aceitar orçamento' });
    }
  });

  // POST /marketplace/services/quotes/:quoteId/decline
  fastify.post<{
    Params: { quoteId: string };
    Body: { customer_actor_id: string };
  }>('/services/quotes/:quoteId/decline', {
    // Rota pública (customer recusa orçamento)
  }, async (req, reply) => {
    try {
      const { quoteId } = req.params;
      const { customer_actor_id } = req.body;

      if (!customer_actor_id) {
        return reply.status(400).send({ error: 'customer_actor_id é obrigatório' });
      }

      const quote = marketplaceService.declineServiceQuote(quoteId, customer_actor_id);
      marketplaceLogger.api('Orçamento recusado', {
        quote_id: quoteId,
        customer_actor_id,
      });
      return reply.status(200).send(quote);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao recusar orçamento', error);
      return reply.status(400).send({ error: error.message || 'Erro ao recusar orçamento' });
    }
  });

  // ============================================================
  // GOVERNANÇA ANTI-DESVIO DE SERVIÇOS (QUOTE & EXECUÇÃO)
  // ============================================================

  // GET /marketplace/providers/:providerActorId/governance-metrics
  fastify.get<{
    Params: { providerActorId: string };
    Querystring: { starts_at?: string; ends_at?: string; category_id?: string };
  }>('/providers/:providerActorId/governance-metrics', {
    // Rota pública (provider vê suas próprias métricas)
  }, async (req, reply) => {
    try {
      const { providerActorId } = req.params;
      const { starts_at, ends_at, category_id } = req.query;

      // Default: últimos 30 dias
      const endDate = ends_at || new Date().toISOString();
      const startDate = starts_at || new Date(new Date(endDate).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const metrics = marketplaceService.calculateServiceGovernanceMetrics(
        providerActorId,
        startDate,
        endDate,
        category_id
      );

      marketplaceLogger.api('Métricas de governança consultadas', {
        provider_actor_id: providerActorId,
        status: metrics.status,
      });

      return reply.status(200).send(metrics);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar métricas de governança', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar métricas' });
    }
  });

  // GET /marketplace/providers/:providerActorId/matching-priority
  fastify.get<{ Params: { providerActorId: string } }>('/providers/:providerActorId/matching-priority', {
    // Rota pública (para debug/teste)
  }, async (req, reply) => {
    try {
      const { providerActorId } = req.params;
      const priority = marketplaceService.calculateMatchingPriority(providerActorId);
      return reply.status(200).send({ provider_actor_id: providerActorId, priority });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao calcular prioridade de matching', error);
      return reply.status(400).send({ error: error.message || 'Erro ao calcular prioridade' });
    }
  });

  // ============================================================
  // TEMPLATES DE NEGÓCIO + IMPORTAÇÃO CANÔNICA DE CATÁLOGO
  // ============================================================

  // GET /marketplace/business-templates
  fastify.get<{
    Querystring: { type?: string };
  }>('/business-templates', {
    // Rota pública (listar templates disponíveis)
  }, async (req, reply) => {
    try {
      const { type } = req.query;
      let templates: BusinessTemplate[] = [];
      if (type) {
        templates = marketplaceService.getBusinessTemplatesByType(type as any);
      } else {
        templates = marketplaceService.getAllBusinessTemplates();
      }
      return reply.status(200).send({ templates });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar templates de negócio', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar templates' });
    }
  });

  // GET /marketplace/business-templates/:templateId
  fastify.get<{ Params: { templateId: string } }>('/business-templates/:templateId', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { templateId } = req.params;
      const template = marketplaceService.getBusinessTemplate(templateId);
      if (!template) {
        return reply.status(404).send({ error: 'Template não encontrado' });
      }
      return reply.status(200).send(template);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar template', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar template' });
    }
  });


  // GET /marketplace/stores/:storeId/imported-products
  fastify.get<{ Params: { storeId: string } }>('/stores/:storeId/imported-products', {
    // Rota protegida (empresa vê produtos importados)
  }, async (req, reply) => {
    try {
      const { storeId } = req.params;
      const products = marketplaceService.getStoreProducts(storeId);
      return reply.status(200).send({ products });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar produtos importados', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar produtos' });
    }
  });

  // GET /marketplace/stores/:storeId/imported-services
  fastify.get<{ Params: { storeId: string } }>('/stores/:storeId/imported-services', {
    // Rota protegida (empresa vê serviços importados)
  }, async (req, reply) => {
    try {
      const { storeId } = req.params;
      const services = marketplaceService.getImportedServices(storeId);
      return reply.status(200).send({ services });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar serviços importados', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar serviços' });
    }
  });

  // POST /marketplace/stores/:storeId/products/:productId/activate
  fastify.post<{
    Params: { storeId: string; productId: string };
    Body: { price: { amountCents: number; currency: string }; stock?: { quantity: number; unit: string } };
  }>('/stores/:storeId/products/:productId/activate', {
    // Rota protegida (empresa ativa produto)
  }, async (req, reply) => {
    try {
      const { storeId, productId } = req.params;
      const { price, stock } = req.body;

      if (!price) {
        return reply.status(400).send({ error: 'price é obrigatório' });
      }

      (marketplaceService as any).activateImportedProduct(storeId, productId, price, stock);
      marketplaceLogger.api('Produto importado ativado', {
        store_id: storeId,
        product_id: productId,
      });
      return reply.status(200).send({ success: true });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao ativar produto', error);
      return reply.status(400).send({ error: error.message || 'Erro ao ativar produto' });
    }
  });

  // POST /marketplace/stores/:storeId/products/:productId/deactivate
  fastify.post<{ Params: { storeId: string; productId: string } }>('/stores/:storeId/products/:productId/deactivate', {
    // Rota protegida (empresa desativa produto)
  }, async (req, reply) => {
    try {
      const { storeId, productId } = req.params;
      (marketplaceService as any).deactivateImportedProduct(storeId, productId);
      marketplaceLogger.api('Produto importado desativado', {
        store_id: storeId,
        product_id: productId,
      });
      return reply.status(200).send({ success: true });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao desativar produto', error);
      return reply.status(400).send({ error: error.message || 'Erro ao desativar produto' });
    }
  });

  // POST /marketplace/service-offerings/:offeringId/activate
  fastify.post<{
    Params: { offeringId: string };
    Body: { price: { amountCents: number; currency: string }; duration_minutes?: number };
  }>('/service-offerings/:offeringId/activate', {
    // Rota protegida (empresa ativa serviço)
  }, async (req, reply) => {
    try {
      const { offeringId } = req.params;
      const { price, duration_minutes } = req.body;

      if (!price) {
        return reply.status(400).send({ error: 'price é obrigatório' });
      }

      (marketplaceService as any).activateImportedService(offeringId, price, duration_minutes);
      marketplaceLogger.api('Serviço importado ativado', {
        offering_id: offeringId,
      });
      return reply.status(200).send({ success: true });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao ativar serviço', error);
      return reply.status(400).send({ error: error.message || 'Erro ao ativar serviço' });
    }
  });

  // POST /marketplace/service-offerings/:offeringId/deactivate
  fastify.post<{ Params: { offeringId: string } }>('/service-offerings/:offeringId/deactivate', {
    // Rota protegida (empresa desativa serviço)
  }, async (req, reply) => {
    try {
      const { offeringId } = req.params;
      (marketplaceService as any).deactivateImportedService(offeringId);
      marketplaceLogger.api('Serviço importado desativado', {
        offering_id: offeringId,
      });
      return reply.status(200).send({ success: true });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao desativar serviço', error);
      return reply.status(400).send({ error: error.message || 'Erro ao desativar serviço' });
    }
  });

  // ============================================================
  // ATORES COLABORADORES (CONTADOR, VENDEDOR, GESTOR)
  // ============================================================

  // POST /marketplace/companies/:companyId/collaborators/invite
  fastify.post<{
    Params: { companyId: string };
    Body: { actor_id: string; role: 'accountant' | 'sales' | 'manager' | 'service_operator'; invited_by: string };
  }>('/companies/:companyId/collaborators/invite', {
    // Rota protegida (empresa convida colaborador)
  }, async (req, reply) => {
    try {
      const { companyId } = req.params;
      const { actor_id, role, invited_by } = req.body;

      if (!actor_id || !role || !invited_by) {
        return reply.status(400).send({ error: 'actor_id, role e invited_by são obrigatórios' });
      }

      const collaborator = (marketplaceService as any).inviteCollaborator({
        company_id: companyId,
        actor_id,
        role,
        invited_by,
      });

      marketplaceLogger.api('Colaborador convidado', {
        company_id: companyId,
        actor_id,
        role,
      });

      return reply.status(200).send(collaborator);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao convidar colaborador', error);
      return reply.status(400).send({ error: error.message || 'Erro ao convidar colaborador' });
    }
  });

  // POST /marketplace/collaborations/:collaborationId/accept
  fastify.post<{
    Params: { collaborationId: string };
    Body: { actor_id: string };
  }>('/collaborations/:collaborationId/accept', {
    // Rota protegida (ator aceita convite)
  }, async (req, reply) => {
    try {
      const { collaborationId } = req.params;
      const { actor_id } = req.body;

      if (!actor_id) {
        return reply.status(400).send({ error: 'actor_id é obrigatório' });
      }

      const collaborator = (marketplaceService as any).acceptCollaborationInvite(collaborationId, actor_id);
      marketplaceLogger.api('Convite aceito', {
        collaboration_id: collaborationId,
        actor_id,
      });
      return reply.status(200).send(collaborator);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao aceitar convite', error);
      return reply.status(400).send({ error: error.message || 'Erro ao aceitar convite' });
    }
  });

  // POST /marketplace/collaborations/:collaborationId/decline
  fastify.post<{
    Params: { collaborationId: string };
    Body: { actor_id: string };
  }>('/collaborations/:collaborationId/decline', {
    // Rota protegida (ator recusa convite)
  }, async (req, reply) => {
    try {
      const { collaborationId } = req.params;
      const { actor_id } = req.body;

      if (!actor_id) {
        return reply.status(400).send({ error: 'actor_id é obrigatório' });
      }

      const collaborator = (marketplaceService as any).declineCollaborationInvite(collaborationId, actor_id);
      marketplaceLogger.api('Convite recusado', {
        collaboration_id: collaborationId,
        actor_id,
      });
      return reply.status(200).send(collaborator);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao recusar convite', error);
      return reply.status(400).send({ error: error.message || 'Erro ao recusar convite' });
    }
  });

  // POST /marketplace/collaborations/:collaborationId/revoke
  fastify.post<{
    Params: { collaborationId: string };
    Body: { revoked_by: string };
  }>('/collaborations/:collaborationId/revoke', {
    // Rota protegida (empresa revoga colaboração)
  }, async (req, reply) => {
    try {
      const { collaborationId } = req.params;
      const { revoked_by } = req.body;

      if (!revoked_by) {
        return reply.status(400).send({ error: 'revoked_by é obrigatório' });
      }

      const collaborator = (marketplaceService as any).revokeCollaboration(collaborationId, revoked_by);
      marketplaceLogger.api('Colaboração revogada', {
        collaboration_id: collaborationId,
        revoked_by,
      });
      return reply.status(200).send(collaborator);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao revogar colaboração', error);
      return reply.status(400).send({ error: error.message || 'Erro ao revogar colaboração' });
    }
  });

  // GET /marketplace/companies/:companyId/collaborators
  fastify.get<{
    Params: { companyId: string };
    Querystring: { status?: 'invited' | 'accepted' | 'revoked' | 'declined' };
  }>('/companies/:companyId/collaborators', {
    // Rota protegida (empresa vê seus colaboradores)
  }, async (req, reply) => {
    try {
      const { companyId } = req.params;
      const { status } = req.query;

      const collaborators = (marketplaceService as any).getCompanyCollaborators(companyId, status);
      return reply.status(200).send({ collaborators });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar colaboradores', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar colaboradores' });
    }
  });

  // GET /marketplace/actors/:actorId/collaborations
  fastify.get<{
    Params: { actorId: string };
    Querystring: { status?: 'invited' | 'accepted' | 'revoked' | 'declined' };
  }>('/actors/:actorId/collaborations', {
    // Rota protegida (ator vê suas colaborações)
  }, async (req, reply) => {
    try {
      const { actorId } = req.params;
      const { status } = req.query;

      const collaborations = (marketplaceService as any).getActorCollaborations(actorId, status);
      return reply.status(200).send({ collaborations });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar colaborações', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar colaborações' });
    }
  });

  // GET /marketplace/collaborations/:collaborationId
  fastify.get<{ Params: { collaborationId: string } }>('/collaborations/:collaborationId', {
    // Rota protegida
  }, async (req, reply) => {
    try {
      const { collaborationId } = req.params;
      const collaboration = (marketplaceService as any).getCollaboration(collaborationId);
      if (!collaboration) {
        return reply.status(404).send({ error: 'Colaboração não encontrada' });
      }
      return reply.status(200).send(collaboration);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar colaboração', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar colaboração' });
    }
  });

  // GET /marketplace/companies/:companyId/actors/:actorId/permissions
  fastify.get<{ Params: { companyId: string; actorId: string } }>('/companies/:companyId/actors/:actorId/permissions', {
    // Rota protegida (verificar permissões de um ator)
  }, async (req, reply) => {
    try {
      const { companyId, actorId } = req.params;
      const permissions = (marketplaceService as any).getActorCompanyPermissions(companyId, actorId);
      return reply.status(200).send({ permissions });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar permissões', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar permissões' });
    }
  });

  // ============================================================
  // EXTENSIBILIDADE CONTROLADA (PLUGINS CANÔNICOS)
  // ============================================================

  // POST /marketplace/plugins/register
  fastify.post<{
    Body: Omit<PluginDefinition, 'pluginId' | 'createdAt' | 'updatedAt'>;
  }>('/plugins/register', {
    // Rota protegida (registrar plugin)
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const plugin = await marketplacePluginService.registerPlugin(tenantId, req.body);
      marketplaceLogger.api('Plugin registrado', {
        plugin_id: plugin.pluginId,
        name: plugin.name,
        category: plugin.category,
      });
      return reply.status(200).send(plugin);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao registrar plugin', error);
      return reply.status(400).send({ error: error.message || 'Erro ao registrar plugin' });
    }
  });

  // GET /marketplace/plugins
  fastify.get<{
    Querystring: { category?: PluginCategory; status?: 'active' | 'inactive' | 'deprecated' };
  }>('/plugins', {
    // Requer tenant para listar plugins do tenant
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const { category, status } = req.query;

      let plugins: PluginDefinition[];
      if (category) {
        plugins = await marketplacePluginService.getPluginsByCategory(tenantId, category, status ?? null);
      } else if (status) {
        const active = await marketplacePluginService.getActivePlugins(tenantId);
        plugins = active.filter(p => p.status === status);
      } else {
        plugins = await marketplacePluginService.getActivePlugins(tenantId);
      }

      return reply.status(200).send({ plugins });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar plugins', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar plugins' });
    }
  });

  // GET /marketplace/plugins/:pluginId
  fastify.get<{ Params: { pluginId: string } }>('/plugins/:pluginId', {
    // Requer tenant
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const { pluginId } = req.params;
      const plugin = await marketplacePluginService.getPlugin(tenantId, pluginId);
      if (!plugin) {
        return reply.status(404).send({ error: 'Plugin não encontrado' });
      }
      return reply.status(200).send(plugin);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar plugin', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar plugin' });
    }
  });

  // POST /marketplace/plugins/:pluginId/status
  fastify.post<{
    Params: { pluginId: string };
    Body: { status: 'active' | 'inactive' | 'deprecated' };
  }>('/plugins/:pluginId/status', {
    // Rota protegida (atualizar status)
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const { pluginId } = req.params;
      const { status } = req.body;

      const plugin = await marketplacePluginService.updatePluginStatus(tenantId, pluginId, status);
      marketplaceLogger.api('Status do plugin atualizado', {
        plugin_id: pluginId,
        status,
      });
      return reply.status(200).send(plugin);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao atualizar status do plugin', error);
      return reply.status(400).send({ error: error.message || 'Erro ao atualizar status' });
    }
  });

  // GET /marketplace/plugins/:pluginId/executions
  fastify.get<{
    Params: { pluginId: string };
    Querystring: { hook?: PluginHook };
  }>('/plugins/:pluginId/executions', {
    // Rota protegida (auditoria)
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const { pluginId } = req.params;
      const { hook } = req.query;

      const executions = await marketplacePluginService.getPluginExecutions(tenantId, pluginId, hook ?? null);
      return reply.status(200).send({ executions });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar execuções', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar execuções' });
    }
  });

  // POST /marketplace/plugins/execute-hook
  fastify.post<{
    Body: {
      hook: PluginHook;
      input_data: Record<string, any>;
      context?: { company_id?: string; store_id?: string; actor_id?: string };
    };
  }>('/plugins/execute-hook', {
    // Rota protegida (executar hook)
  }, async (req, reply) => {
    try {
      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const { hook, input_data, context } = req.body;

      if (!hook || !input_data) {
        return reply.status(400).send({ error: 'hook e input_data são obrigatórios' });
      }

      const results = await marketplacePluginService.executePluginHook(tenantId, hook, input_data, context);
      marketplaceLogger.api('Hook de plugin executado', {
        hook,
        plugins_executed: results.length,
      });
      return reply.status(200).send({ results });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao executar hook', error);
      return reply.status(400).send({ error: error.message || 'Erro ao executar hook' });
    }
  });

  // ============================================================
  // AVALIAÇÃO PÓS-SERVIÇO BIDIRECIONAL (USUÁRIO ⇄ PRESTADOR)
  // ============================================================

  // POST /marketplace/services/requests/:requestId/evaluations
  fastify.post<{
    Params: { requestId: string };
    Body: {
      evaluator_type: 'user' | 'provider';
      evaluator_actor_id: string;
      scores: {
        execution_quality: number;
        punctuality: number;
        communication: number;
        compliance: number;
      };
    };
  }>('/services/requests/:requestId/evaluations', {
    // Rota protegida (criar avaliação)
  }, async (req, reply) => {
    try {
      const { requestId } = req.params;
      const { evaluator_type, evaluator_actor_id, scores } = req.body;

      if (!evaluator_type || !evaluator_actor_id || !scores) {
        return reply.status(400).send({ error: 'evaluator_type, evaluator_actor_id e scores são obrigatórios' });
      }

      const evaluation = (marketplaceService as any).createServiceEvaluation({
        request_id: requestId,
        evaluator_type,
        evaluator_actor_id,
        scores,
      });

      marketplaceLogger.api('Avaliação de serviço criada', {
        evaluation_id: evaluation.evaluation_id,
        request_id: requestId,
        evaluator_type,
      });

      return reply.status(200).send(evaluation);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao criar avaliação', error);
      return reply.status(400).send({ error: error.message || 'Erro ao criar avaliação' });
    }
  });

  // GET /marketplace/services/requests/:requestId/evaluations
  fastify.get<{ Params: { requestId: string } }>('/services/requests/:requestId/evaluations', {
    // Rota protegida (ver avaliações de um request)
  }, async (req, reply) => {
    try {
      const { requestId } = req.params;
      const evaluations = marketplaceService.getServiceQuotesByRequest(requestId);
      return reply.status(200).send({ evaluations });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar avaliações', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar avaliações' });
    }
  });

  // GET /marketplace/actors/:actorId/evaluations
  fastify.get<{
    Params: { actorId: string };
    Querystring: { starts_at?: string; ends_at?: string };
  }>('/actors/:actorId/evaluations', {
    // Rota protegida (ver avaliações de um ator)
  }, async (req, reply) => {
    try {
      const { actorId } = req.params;
      const { starts_at, ends_at } = req.query;

      const period = starts_at && ends_at ? { starts_at, ends_at } : undefined;
      const evaluations = (marketplaceService as any).getActorEvaluations(actorId, period);
      return reply.status(200).send({ evaluations });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar avaliações do ator', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar avaliações' });
    }
  });

  // GET /marketplace/actors/:actorId/evaluation-aggregates
  fastify.get<{
    Params: { actorId: string };
    Querystring: { starts_at: string; ends_at: string };
  }>('/actors/:actorId/evaluation-aggregates', {
    // Rota protegida (ver agregados de avaliação)
  }, async (req, reply) => {
    try {
      const { actorId } = req.params;
      const { starts_at, ends_at } = req.query;

      if (!starts_at || !ends_at) {
        return reply.status(400).send({ error: 'starts_at e ends_at são obrigatórios' });
      }

      const aggregates = (marketplaceService as any).calculateEvaluationAggregates(actorId, {
        starts_at,
        ends_at,
      });

      return reply.status(200).send(aggregates);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao calcular agregados', error);
      return reply.status(400).send({ error: error.message || 'Erro ao calcular agregados' });
    }
  });

  // GET /marketplace/services/requests/:requestId/evaluation-window
  fastify.get<{ Params: { requestId: string } }>('/services/requests/:requestId/evaluation-window', {
    // Rota protegida (ver janela de avaliação)
  }, async (req, reply) => {
    try {
      const { requestId } = req.params;
      const window = (marketplaceService as any).getEvaluationWindow(requestId);
      if (!window) {
        return reply.status(404).send({ error: 'Janela de avaliação não encontrada' });
      }
      return reply.status(200).send(window);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar janela de avaliação', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar janela' });
    }
  });

  // ============================================================
  // TEMPLATES CANÔNICOS DE CATÁLOGO POR CATEGORIA (IMPORTAÇÃO INICIAL)
  // ============================================================

  // GET /marketplace/product-templates
  fastify.get<{
    Querystring: { category_id?: string; business_template_id?: string };
  }>('/product-templates', {
    // Rota pública (listar templates disponíveis)
  }, async (req, reply) => {
    try {
      const { category_id, business_template_id } = req.query;

      let templates: ProductTemplate[] = [];
      if (business_template_id) {
        templates = marketplaceService.getProductTemplatesByBusinessTemplate(business_template_id);
      } else if (category_id) {
        templates = marketplaceService.getProductTemplatesByCategory(category_id);
      } else {
        templates = marketplaceService.getAllProductTemplates();
      }

      return reply.status(200).send({ templates });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar product templates', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar templates' });
    }
  });

  // GET /marketplace/product-templates/:templateId
  fastify.get<{ Params: { templateId: string } }>('/product-templates/:templateId', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { templateId } = req.params;
      const template = marketplaceService.getProductTemplate(templateId);
      if (!template) {
        return reply.status(404).send({ error: 'Template não encontrado' });
      }
      return reply.status(200).send(template);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar template', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar template' });
    }
  });

  // GET /marketplace/service-templates-canonical
  fastify.get<{
    Querystring: { category_id?: string; business_template_id?: string };
  }>('/service-templates-canonical', {
    // Rota pública (listar templates disponíveis)
  }, async (req, reply) => {
    try {
      const { category_id, business_template_id } = req.query;

      let templates: ServiceTemplateCanonical[] = [];
      if (business_template_id) {
        templates = marketplaceService.getServiceTemplatesCanonicalByBusinessTemplate(business_template_id);
      } else if (category_id) {
        templates = marketplaceService.getServiceTemplatesCanonicalByCategory(category_id);
      } else {
        templates = marketplaceService.getAllServiceTemplatesCanonical();
      }

      return reply.status(200).send({ templates });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar service templates', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar templates' });
    }
  });

  // GET /marketplace/service-templates-canonical/:templateId
  fastify.get<{ Params: { templateId: string } }>('/service-templates-canonical/:templateId', {
    // Rota pública
  }, async (req, reply) => {
    try {
      const { templateId } = req.params;
      const template = marketplaceService.getServiceTemplateCanonical(templateId);
      if (!template) {
        return reply.status(404).send({ error: 'Template não encontrado' });
      }
      return reply.status(200).send(template);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar template', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar template' });
    }
  });

  // POST /marketplace/companies/:companyId/stores/:storeId/import-catalog
  fastify.post<{
    Params: { companyId: string; storeId: string };
    Body: {
      business_template_id: string;
      import_all?: boolean;
      import_partial?: boolean;
      product_template_ids?: string[];
      service_template_ids?: string[];
      skip_product_templates?: string[];
      skip_service_templates?: string[];
    };
  }>('/companies/:companyId/stores/:storeId/import-catalog', {
    // Rota protegida (empresa importa catálogo)
  }, async (req, reply) => {
    try {
      const { companyId, storeId } = req.params;
      const {
        business_template_id,
        import_all,
        import_partial,
        product_template_ids,
        service_template_ids,
        skip_product_templates,
        skip_service_templates,
      } = req.body;

      if (!business_template_id) {
        return reply.status(400).send({ error: 'business_template_id é obrigatório' });
      }

      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const result = await marketplaceService.importCanonicalCatalog(tenantId, companyId, storeId, business_template_id, {
        import_all,
        import_partial,
        product_template_ids,
        serviceTemplateIds: service_template_ids,
        skip_product_templates,
        skip_service_templates,
      });

      marketplaceLogger.api('Catálogo canônico importado', {
        company_id: companyId,
        store_id: storeId,
        business_template_id,
      });

      return reply.status(200).send(result);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao importar catálogo', error);
      return reply.status(400).send({ error: error.message || 'Erro ao importar catálogo' });
    }
  });

  // POST /marketplace/stores/:storeId/import-product-templates
  fastify.post<{
    Params: { storeId: string };
    Body: {
      template_ids: string[];
      import_all?: boolean;
      import_partial?: boolean;
      skip_items?: string[];
    };
  }>('/stores/:storeId/import-product-templates', {
    // Rota protegida (empresa importa product templates)
  }, async (req, reply) => {
    try {
      const { storeId } = req.params;
      const { template_ids, import_all, import_partial, skip_items } = req.body;

      if (!template_ids || template_ids.length === 0) {
        return reply.status(400).send({ error: 'template_ids é obrigatório' });
      }

      if (!req.tenant) {
        return reply.status(401).send({ error: 'Tenant required' });
      }
      const tenantId = req.tenant.id;
      const result = await marketplaceService.importProductTemplates(tenantId, storeId, template_ids, {
        import_all,
        import_partial,
        skip_items,
      });

      marketplaceLogger.api('Product templates importados', {
        store_id: storeId,
        imported_count: result.imported_count,
      });

      return reply.status(200).send(result);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao importar product templates', error);
      return reply.status(400).send({ error: error.message || 'Erro ao importar templates' });
    }
  });

  // POST /marketplace/stores/:storeId/import-service-templates
  fastify.post<{
    Params: { storeId: string };
    Body: {
      template_ids: string[];
      import_all?: boolean;
      import_partial?: boolean;
      skip_items?: string[];
    };
  }>('/stores/:storeId/import-service-templates', {
    // Rota protegida (empresa importa service templates)
  }, async (req, reply) => {
    try {
      const { storeId } = req.params;
      const { template_ids, import_all, import_partial, skip_items } = req.body;

      if (!template_ids || template_ids.length === 0) {
        return reply.status(400).send({ error: 'template_ids é obrigatório' });
      }

      const result = marketplaceService.importServiceTemplates(storeId, template_ids, {
        import_all,
        import_partial,
        skip_items,
      });

      marketplaceLogger.api('Service templates importados', {
        store_id: storeId,
        imported_count: result.imported_count,
      });

      return reply.status(200).send(result);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao importar service templates', error);
      return reply.status(400).send({ error: error.message || 'Erro ao importar templates' });
    }
  });

  // GET /marketplace/template-usage-audit
  fastify.get<{
    Querystring: { template_id?: string; category_id?: string };
  }>('/template-usage-audit', {
    // Rota protegida (auditoria de uso de templates)
  }, async (req, reply) => {
    try {
      const { template_id, category_id } = req.query;
      const audit = marketplaceService.getTemplateUsageAudit(template_id, category_id);
      return reply.status(200).send({ audit });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar auditoria', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar auditoria' });
    }
  });

  // ============================================================
  // BUSINESS TEMPLATES (ARQUÉTIPOS DE EMPRESA) + ATIVAÇÃO GUIADA
  // ============================================================

  // GET /marketplace/companies/:companyId/activation-state
  fastify.get<{ Params: { companyId: string } }>('/companies/:companyId/activation-state', {
    // Rota protegida (ver estado de ativação)
  }, async (req, reply) => {
    try {
      const { companyId } = req.params;
      const state = marketplaceService.getCompanyActivationState(companyId);
      if (!state) {
        return reply.status(404).send({ error: 'Estado de ativação não encontrado' });
      }
      return reply.status(200).send(state);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar estado de ativação', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar estado' });
    }
  });

  // GET /marketplace/business-templates/usage-audit
  fastify.get<{
    Querystring: { template_id?: string };
  }>('/business-templates/usage-audit', {
    // Rota protegida (auditoria de uso de business templates)
  }, async (req, reply) => {
    try {
      const { template_id } = req.query;
      const audit = marketplaceService.getBusinessTemplateUsageAudit(template_id);
      return reply.status(200).send({ audit });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar auditoria de business templates', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar auditoria' });
    }
  });

  // ============================================================
  // ESCALA DE SERVIÇOS & CAPACIDADE PRODUTIVA (MULTI-AGENDA)
  // ============================================================

  // POST /marketplace/stores/:storeId/resources
  fastify.post<{
    Params: { storeId: string };
    Body: {
      type: 'individual_provider' | 'company_professional' | 'equipment' | 'facility';
      name: string;
      description?: string;
      actor_id?: string;
      physical_id?: string;
      has_own_agenda?: boolean;
      required_for_services?: string[];
    };
  }>('/stores/:storeId/resources', {
    // Rota protegida (criar/atualizar ServiceResource)
  }, async (req, reply) => {
    try {
      const { storeId } = req.params;
      const body = req.body;

      const resource = marketplaceService.createOrUpdateServiceResource(storeId, body.type, body.name, {
        description: body.description,
        actorId: body.actor_id,
        physical_id: body.physical_id,
        has_own_agenda: body.has_own_agenda,
        required_for_services: body.required_for_services,
      });

      return reply.status(201).send(resource);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao criar/atualizar ServiceResource', error);
      return reply.status(400).send({ error: error.message || 'Erro ao criar recurso' });
    }
  });

  // GET /marketplace/stores/:storeId/resources
  fastify.get<{
    Params: { storeId: string };
  }>('/stores/:storeId/resources', {
    // Rota protegida (listar ServiceResources de uma loja)
  }, async (req, reply) => {
    try {
      const { storeId } = req.params;
      const resources = marketplaceService.getServiceResourcesByStore(storeId);
      return reply.status(200).send({ resources });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao listar ServiceResources', error);
      return reply.status(400).send({ error: error.message || 'Erro ao listar recursos' });
    }
  });

  // GET /marketplace/resources/:resourceId
  fastify.get<{
    Params: { resourceId: string };
  }>('/resources/:resourceId', {
    // Rota protegida (buscar ServiceResource por ID)
  }, async (req, reply) => {
    try {
      const { resourceId } = req.params;
      const resource = marketplaceService.getServiceResource(resourceId);
      if (!resource) {
        return reply.status(404).send({ error: 'Recurso não encontrado' });
      }
      return reply.status(200).send(resource);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar ServiceResource', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar recurso' });
    }
  });

  // PATCH /marketplace/resources/:resourceId/status
  fastify.patch<{
    Params: { resourceId: string };
    Body: {
      status: 'active' | 'unavailable' | 'overloaded' | 'maintenance';
      reason?: string;
    };
  }>('/resources/:resourceId/status', {
    // Rota protegida (atualizar status de ServiceResource)
  }, async (req, reply) => {
    try {
      const { resourceId } = req.params;
      const { status, reason } = req.body;

      const resource = marketplaceService.updateServiceResourceStatus(resourceId, status, reason);
      if (!resource) {
        return reply.status(404).send({ error: 'Recurso não encontrado' });
      }

      return reply.status(200).send(resource);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao atualizar status de ServiceResource', error);
      return reply.status(400).send({ error: error.message || 'Erro ao atualizar status' });
    }
  });

  // POST /marketplace/services/:serviceTemplateId/resource-dependencies
  fastify.post<{
    Params: { serviceTemplateId: string };
    Body: {
      required_resources: string[];
      all_required?: boolean;
    };
  }>('/services/:serviceTemplateId/resource-dependencies', {
    // Rota protegida (criar dependência de recursos)
  }, async (req, reply) => {
    try {
      const { serviceTemplateId } = req.params;
      const { required_resources, all_required } = req.body;

      const dependency = marketplaceService.createResourceDependency(
        serviceTemplateId,
        required_resources,
        all_required ?? true
      );

      return reply.status(201).send(dependency);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao criar dependência de recursos', error);
      return reply.status(400).send({ error: error.message || 'Erro ao criar dependência' });
    }
  });

  // GET /marketplace/services/:serviceTemplateId/resource-dependencies
  fastify.get<{
    Params: { serviceTemplateId: string };
  }>('/services/:serviceTemplateId/resource-dependencies', {
    // Rota protegida (buscar dependências de recursos)
  }, async (req, reply) => {
    try {
      const { serviceTemplateId } = req.params;
      const dependencies = marketplaceService.getResourceDependenciesByService(serviceTemplateId);
      return reply.status(200).send({ dependencies });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar dependências de recursos', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar dependências' });
    }
  });

  // GET /marketplace/stores/:storeId/capacity-metrics
  fastify.get<{
    Params: { storeId: string };
  }>('/stores/:storeId/capacity-metrics', {
    // Rota protegida (buscar métricas de capacidade agregadas)
  }, async (req, reply) => {
    try {
      const { storeId } = req.params;
      const metrics = marketplaceService.getCompanyCapacityMetrics(storeId);
      if (!metrics) {
        return reply.status(404).send({ error: 'Métricas não encontradas' });
      }
      return reply.status(200).send(metrics);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar métricas de capacidade', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar métricas' });
    }
  });

  // GET /marketplace/resources/:resourceId/capacity-metrics
  fastify.get<{
    Params: { resourceId: string };
  }>('/resources/:resourceId/capacity-metrics', {
    // Rota protegida (buscar métricas de capacidade de um recurso)
  }, async (req, reply) => {
    try {
      const { resourceId } = req.params;
      const metrics = marketplaceService.getResourceCapacityMetrics(resourceId);
      if (!metrics) {
        return reply.status(404).send({ error: 'Métricas não encontradas' });
      }
      return reply.status(200).send(metrics);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar métricas de capacidade do recurso', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar métricas' });
    }
  });

  // ============================================================
  // GESTÃO DE COMISSÃO & REPASSE INTERNO POR RECURSO (PROMPT 24)
  // ============================================================

  // POST /marketplace/resources/:resourceId/compensation-config
  fastify.post<{
    Params: { resourceId: string };
    Body: {
      compensation_model: 'none' | 'fixed_percent' | 'fixed_value' | 'salary' | 'mixed';
      percent_value?: number;
      fixed_amount?: number;
      currency?: string;
      monthly_salary?: number;
      base_salary?: number;
      variable_percent?: number;
      min_compensation?: number;
      max_compensation?: number;
      active: boolean;
      effective_from: string;
      effective_until?: string;
    };
  }>('/resources/:resourceId/compensation-config', {
    // Rota protegida (configurar modelo de compensação)
  }, async (req, reply) => {
    try {
      const { resourceId } = req.params;
      const body = req.body;
      if (body.effective_from == null) {
        throw new Error('effective_from is required');
      }
      const input = {
        compensationModel: body.compensation_model,
        percentValueBps: body.percent_value,
        fixedAmountCents: body.fixed_amount,
        currency: body.currency,
        monthlySalaryCents: body.monthly_salary,
        baseSalaryCents: body.base_salary,
        variablePercentBps: body.variable_percent,
        minCompensationCents: body.min_compensation,
        maxCompensationCents: body.max_compensation,
        isActive: body.active ?? true,
        effectiveFrom: body.effective_from,
        effectiveUntil: body.effective_until,
        immutable: false,
      };
      const config = marketplaceService.setResourceCompensationConfig(resourceId, input);
      return reply.status(201).send(config);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao configurar compensação', error);
      return reply.status(400).send({ error: error.message || 'Erro ao configurar compensação' });
    }
  });

  // GET /marketplace/resources/:resourceId/compensation-config
  fastify.get<{
    Params: { resourceId: string };
  }>('/resources/:resourceId/compensation-config', {
    // Rota protegida (buscar configuração de compensação)
  }, async (req, reply) => {
    try {
      const { resourceId } = req.params;
      const config = marketplaceService.getResourceCompensationConfig(resourceId);
      if (!config) {
        return reply.status(404).send({ error: 'Configuração não encontrada' });
      }
      return reply.status(200).send(config);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar configuração de compensação', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar configuração' });
    }
  });

  // GET /marketplace/resources/:resourceId/compensations
  fastify.get<{
    Params: { resourceId: string };
    Querystring: {
      starts_at?: string;
      ends_at?: string;
      status?: 'calculated' | 'pending' | 'paid' | 'cancelled';
    };
  }>('/resources/:resourceId/compensations', {
    // Rota protegida (buscar compensações de um recurso)
  }, async (req, reply) => {
    try {
      const { resourceId } = req.params;
      const { starts_at, ends_at, status } = req.query;

      const compensations = marketplaceService.getResourceCompensations(resourceId, {
        starts_at,
        ends_at,
        status: status as any,
      });

      return reply.status(200).send({ compensations });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar compensações', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar compensações' });
    }
  });

  // GET /marketplace/stores/:storeId/compensations
  fastify.get<{
    Params: { storeId: string };
    Querystring: {
      starts_at?: string;
      ends_at?: string;
      status?: 'calculated' | 'pending' | 'paid' | 'cancelled';
    };
  }>('/stores/:storeId/compensations', {
    // Rota protegida (buscar compensações de uma empresa)
  }, async (req, reply) => {
    try {
      const { storeId } = req.params;
      const { starts_at, ends_at, status } = req.query;

      const compensations = marketplaceService.getCompanyCompensations(storeId, {
        starts_at,
        ends_at,
        status: status as any,
      });

      return reply.status(200).send({ compensations });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar compensações da empresa', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar compensações' });
    }
  });

  // GET /marketplace/resources/:resourceId/compensation-history
  fastify.get<{
    Params: { resourceId: string };
    Querystring: {
      starts_at: string;
      ends_at: string;
    };
  }>('/resources/:resourceId/compensation-history', {
    // Rota protegida (gerar histórico de compensações)
  }, async (req, reply) => {
    try {
      const { resourceId } = req.params;
      const { starts_at, ends_at } = req.query;

      if (!starts_at || !ends_at) {
        return reply.status(400).send({ error: 'starts_at e ends_at são obrigatórios' });
      }

      const history = marketplaceService.generateResourceCompensationHistory(
        resourceId,
        starts_at,
        ends_at
      );

      return reply.status(200).send(history);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao gerar histórico de compensações', error);
      return reply.status(400).send({ error: error.message || 'Erro ao gerar histórico' });
    }
  });

  // GET /marketplace/stores/:storeId/compensation-report
  fastify.get<{
    Params: { storeId: string };
    Querystring: {
      starts_at: string;
      ends_at: string;
    };
  }>('/stores/:storeId/compensation-report', {
    // Rota protegida (gerar relatório contábil de compensações)
  }, async (req, reply) => {
    try {
      const { storeId } = req.params;
      const { starts_at, ends_at } = req.query;

      if (!starts_at || !ends_at) {
        return reply.status(400).send({ error: 'starts_at e ends_at são obrigatórios' });
      }

      const report = marketplaceService.generateCompanyCompensationReport(
        storeId,
        starts_at,
        ends_at
      );

      return reply.status(200).send(report);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao gerar relatório de compensações', error);
      return reply.status(400).send({ error: error.message || 'Erro ao gerar relatório' });
    }
  });

  // POST /marketplace/services/orders/:serviceOrderId/process-compensation
  fastify.post<{
    Params: { serviceOrderId: string };
    Body: {
      service_booking_id: string;
      completed_resources: string[]; // IDs dos recursos que executaram o serviço
    };
  }>('/services/orders/:serviceOrderId/process-compensation', {
    // Rota protegida (processar compensação após conclusão de serviço)
  }, async (req, reply) => {
    try {
      const { serviceOrderId } = req.params;
      const { service_booking_id, completed_resources } = req.body;

      const compensations = await marketplaceService.processResourceCompensation(
        serviceOrderId,
        service_booking_id,
        completed_resources
      );

      return reply.status(200).send({ compensations });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao processar compensação', error);
      return reply.status(400).send({ error: error.message || 'Erro ao processar compensação' });
    }
  });

  // PATCH /marketplace/compensations/:compensationId/mark-paid
  fastify.patch<{
    Params: { compensationId: string };
  }>('/compensations/:compensationId/mark-paid', {
    // Rota protegida (marcar compensação como paga)
  }, async (req, reply) => {
    try {
      const { compensationId } = req.params;

      const compensation = marketplaceService.markCompensationAsPaid(compensationId);
      if (!compensation) {
        return reply.status(404).send({ error: 'Compensação não encontrada' });
      }

      return reply.status(200).send(compensation);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao marcar compensação como paga', error);
      return reply.status(400).send({ error: error.message || 'Erro ao marcar como paga' });
    }
  });

  // ============================================================
  // VOUCHERS LOCAIS & OFERTAS RELÂMPAGO (PROMPT 25)
  // ============================================================

  // POST /marketplace/stores/:storeId/vouchers/offers
  fastify.post<{
    Params: { storeId: string };
    Body: {
      type: 'product' | 'service' | 'bundle';
      title: string;
      description: string;
      visibility_scope: 'local_neighborhood' | 'city' | 'restricted_group';
      restricted_group_ids?: string[];
      startAt: string;
      endAt: string;
      redemption_deadlineAt?: string;
      quantity_total: number;
      quantity_per_user?: number;
      eligibility?: {
        min_trust_level?: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
        new_users_only?: boolean;
        first_purchase_required?: boolean;
      };
      schedule_constraints?: {
        weekdays?: number[];
        time_start?: string;
        time_end?: string;
      };
      pickup_constraints?: {
        max_minutes_after_claim?: number;
        requires_checkin?: boolean;
      };
      linked_product_id?: string;
      linked_service_template_id?: string;
      linked_service_offering_id?: string;
      linked_bundle_items?: Array<{
        product_id?: string;
        service_offering_id?: string;
        quantity: number;
      }>;
      discount_value?: {
        type: 'percentage' | 'fixed';
        amountCents: number;
        currency: string;
      };
    };
  }>('/stores/:storeId/vouchers/offers', {
    // Rota protegida (criar oferta de voucher)
  }, async (req, reply) => {
    try {
      const { storeId } = req.params;
      const body = req.body;
      const userId = req.user?.id || req.tenant?.id || '';

      type CreateVoucherOfferInput = Omit<VoucherOffer, 'offerId' | 'issuerActorId' | 'storeId' | 'quantityClaimed' | 'status' | 'createdAt' | 'updatedAt'>;
      const offerInput: CreateVoucherOfferInput = {
        type: body.type,
        title: body.title,
        description: body.description,
        visibilityScope: body.visibility_scope,
        startAt: body.startAt,
        endAt: body.endAt,
        quantityTotal: body.quantity_total,
        quantityPerUser: body.quantity_per_user ?? 1,
        immutable: false,
        eligibility: {
          ...(body.eligibility?.min_trust_level != null && { minTrustLevel: body.eligibility.min_trust_level }),
          ...(body.eligibility?.new_users_only !== undefined && { newUsersOnly: body.eligibility.new_users_only }),
          ...(body.eligibility?.first_purchase_required !== undefined && { firstPurchaseRequired: body.eligibility.first_purchase_required }),
        },
        ...(body.restricted_group_ids != null && { restrictedGroupIds: body.restricted_group_ids }),
        ...(body.redemption_deadlineAt != null && { redemptionDeadlineAt: body.redemption_deadlineAt }),
        ...(body.schedule_constraints && {
          scheduleConstraints: {
            ...(body.schedule_constraints.weekdays != null && { weekdays: body.schedule_constraints.weekdays }),
            ...(body.schedule_constraints.time_start != null && { timeStart: body.schedule_constraints.time_start }),
            ...(body.schedule_constraints.time_end != null && { timeEnd: body.schedule_constraints.time_end }),
          },
        }),
        ...(body.pickup_constraints && {
          pickupConstraints: {
            ...(body.pickup_constraints.max_minutes_after_claim != null && { maxMinutesAfterClaim: body.pickup_constraints.max_minutes_after_claim }),
            ...(body.pickup_constraints.requires_checkin !== undefined && { requiresCheckin: body.pickup_constraints.requires_checkin }),
          },
        }),
        ...(body.linked_product_id != null && { linkedProductId: body.linked_product_id }),
        ...(body.linked_service_template_id != null && { linkedServiceTemplateId: body.linked_service_template_id }),
        ...(body.linked_service_offering_id != null && { linkedServiceOfferingId: body.linked_service_offering_id }),
        ...(body.linked_bundle_items != null && body.linked_bundle_items.length > 0 && {
          linkedBundleItems: body.linked_bundle_items.map((i: { product_id?: string; service_offering_id?: string; quantity: number }) => {
            const item: { productId?: string; serviceOfferingId?: string; quantity: number } = { quantity: i.quantity };
            if (i.product_id != null) item.productId = i.product_id;
            if (i.service_offering_id != null) item.serviceOfferingId = i.service_offering_id;
            return item;
          }),
        }),
        ...(body.discount_value && {
          discountValue: {
            type: body.discount_value.type,
            amountCents: body.discount_value.amountCents,
            currency: body.discount_value.currency,
          },
        }),
      };
      const offer = marketplaceService.createVoucherOffer(userId, storeId, offerInput);
      return reply.status(201).send(offer);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao criar oferta de voucher', error);
      return reply.status(400).send({ error: error.message || 'Erro ao criar oferta' });
    }
  });

  // POST /marketplace/vouchers/offers/:offerId/activate
  fastify.post<{
    Params: { offerId: string };
  }>('/vouchers/offers/:offerId/activate', {
    // Rota protegida (ativar oferta)
  }, async (req, reply) => {
    try {
      const { offerId } = req.params;
      const offer = marketplaceService.activateVoucherOffer(offerId);
      if (!offer) {
        return reply.status(404).send({ error: 'Oferta não encontrada' });
      }
      return reply.status(200).send(offer);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao ativar oferta', error);
      return reply.status(400).send({ error: error.message || 'Erro ao ativar oferta' });
    }
  });

  // POST /marketplace/vouchers/offers/:offerId/pause
  fastify.post<{
    Params: { offerId: string };
  }>('/vouchers/offers/:offerId/pause', {
    // Rota protegida (pausar oferta)
  }, async (req, reply) => {
    try {
      const { offerId } = req.params;
      const offer = marketplaceService.pauseVoucherOffer(offerId);
      if (!offer) {
        return reply.status(404).send({ error: 'Oferta não encontrada' });
      }
      return reply.status(200).send(offer);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao pausar oferta', error);
      return reply.status(400).send({ error: error.message || 'Erro ao pausar oferta' });
    }
  });

  // POST /marketplace/vouchers/claims/:claimId/redeem
  fastify.post<{
    Params: { claimId: string };
    Body: {
      presented_code: string;
    };
  }>('/vouchers/claims/:claimId/redeem', {
    // Rota protegida (validar resgate na loja)
  }, async (req, reply) => {
    try {
      const { claimId } = req.params;
      const { presented_code } = req.body;
      const storeOperatorId = req.user?.id || req.tenant?.id || '';

      const result = await marketplaceService.redeemVoucherClaim(claimId, storeOperatorId, presented_code);
      return reply.status(200).send(result);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao resgatar voucher', error);
      return reply.status(400).send({ error: error.message || 'Erro ao resgatar voucher' });
    }
  });

  // POST /marketplace/vouchers/claims/:claimId/no-show
  fastify.post<{
    Params: { claimId: string };
  }>('/vouchers/claims/:claimId/no-show', {
    // Rota protegida (marcar no-show)
  }, async (req, reply) => {
    try {
      const { claimId } = req.params;
      const claim = marketplaceService.markNoShow(claimId);
      if (!claim) {
        return reply.status(404).send({ error: 'Claim não encontrado' });
      }
      return reply.status(200).send(claim);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao marcar no-show', error);
      return reply.status(400).send({ error: error.message || 'Erro ao marcar no-show' });
    }
  });

  // ============================================================
  // CAPACIDADE REGIONAL & GARGALOS (LEITURA ESTRUTURAL) (PROMPT 16)
  // ============================================================

  // GET /marketplace/regional-capacity/metrics
  fastify.get<{
    Querystring: {
      region_id: string;
      service_category?: string;
      status?: 'healthy' | 'warning' | 'critical';
    };
  }>('/regional-capacity/metrics', {
    // Rota protegida (buscar métricas de capacidade regional)
  }, async (req, reply) => {
    try {
      const { region_id, service_category, status } = req.query;

      if (!region_id) {
        return reply.status(400).send({ error: 'region_id é obrigatório' });
      }

      const metrics = marketplaceService.listRegionalCapacityMetrics({
        regionId: region_id,
        serviceCategory: service_category,
        status: status as any,
      });

      return reply.status(200).send({ metrics });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar métricas de capacidade regional', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar métricas' });
    }
  });

  // GET /marketplace/regional-capacity/metrics/:regionId/:categoryId
  fastify.get<{
    Params: { regionId: string; categoryId: string };
  }>('/regional-capacity/metrics/:regionId/:categoryId', {
    // Rota protegida (buscar métrica específica)
  }, async (req, reply) => {
    try {
      const { regionId, categoryId } = req.params;
      const metric = marketplaceService.getRegionalCapacityMetric(regionId, categoryId);
      if (!metric) {
        return reply.status(404).send({ error: 'Métrica não encontrada' });
      }
      return reply.status(200).send(metric);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar métrica de capacidade regional', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar métrica' });
    }
  });

  // POST /marketplace/regional-capacity/snapshots
  fastify.post<{
    Body: {
      region_id: string;
      period: {
        start: string;
        end: string;
      };
      period_type?: 'weekly' | 'monthly';
    };
  }>('/regional-capacity/snapshots', {
    // Rota protegida (gerar snapshot de capacidade regional)
  }, async (req, reply) => {
    try {
      const { region_id, period, period_type } = req.body;

      if (!region_id || !period.start || !period.end) {
        return reply.status(400).send({ error: 'region_id e period são obrigatórios' });
      }

      const snapshot = marketplaceService.generateRegionalCapacitySnapshot(
        region_id,
        period,
        period_type || 'monthly'
      );

      return reply.status(201).send(snapshot);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao gerar snapshot de capacidade regional', error);
      return reply.status(400).send({ error: error.message || 'Erro ao gerar snapshot' });
    }
  });

  // GET /marketplace/regional-capacity/snapshots
  fastify.get<{
    Querystring: {
      region_id?: string;
      period_type?: 'weekly' | 'monthly';
      starts_at?: string;
      ends_at?: string;
    };
  }>('/regional-capacity/snapshots', {
    // Rota protegida (listar snapshots)
  }, async (req, reply) => {
    try {
      const { region_id, period_type, starts_at, ends_at } = req.query;

      const snapshots = marketplaceService.listRegionalCapacitySnapshots({
        regionId: region_id,
        periodType: period_type as any,
        starts_at,
        ends_at,
      });

      return reply.status(200).send({ snapshots });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao listar snapshots de capacidade regional', error);
      return reply.status(400).send({ error: error.message || 'Erro ao listar snapshots' });
    }
  });

  // GET /marketplace/regional-capacity/snapshots/:snapshotId
  fastify.get<{
    Params: { snapshotId: string };
  }>('/regional-capacity/snapshots/:snapshotId', {
    // Rota protegida (buscar snapshot específico)
  }, async (req, reply) => {
    try {
      const { snapshotId } = req.params;
      const snapshot = marketplaceService.getRegionalCapacitySnapshot(snapshotId);
      if (!snapshot) {
        return reply.status(404).send({ error: 'Snapshot não encontrado' });
      }
      return reply.status(200).send(snapshot);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar snapshot de capacidade regional', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar snapshot' });
    }
  });

  // ============================================================
  // EXPANSÃO GUIADA DE PRESTADORES (SERVIÇOS) (PROMPT 17)
  // ============================================================

  // POST /marketplace/regional-expansion/generate-signals
  fastify.post<{
    Body: {
      snapshot_id: string;
    };
  }>('/regional-expansion/generate-signals', {
    // Rota protegida (gerar sinais de expansão a partir de snapshot)
  }, async (req, reply) => {
    try {
      const { snapshot_id } = req.body;

      if (!snapshot_id) {
        return reply.status(400).send({ error: 'snapshot_id é obrigatório' });
      }

      const signals = marketplaceService.generateExpansionSignalsFromSnapshot(snapshot_id);
      return reply.status(201).send({ signals });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao gerar sinais de expansão', error);
      return reply.status(400).send({ error: error.message || 'Erro ao gerar sinais' });
    }
  });

  // GET /marketplace/regional-expansion/signals
  fastify.get<{
    Querystring: {
      region_id?: string;
      service_category?: string;
      signal_type?: 'need_more_providers' | 'need_more_capacity' | 'need_specialized_provider' | 'need_extended_hours';
    };
  }>('/regional-expansion/signals', {
    // Rota protegida (listar sinais de expansão ativos)
  }, async (req, reply) => {
    try {
      const { region_id, service_category, signal_type } = req.query;

      const signals = marketplaceService.getActiveExpansionSignals({
        regionId: region_id,
        serviceCategory: service_category,
        signalType: signal_type as any,
      });

      return reply.status(200).send({ signals });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao listar sinais de expansão', error);
      return reply.status(400).send({ error: error.message || 'Erro ao listar sinais' });
    }
  });

  // GET /marketplace/regional-expansion/unlocks
  fastify.get<{
    Querystring: {
      region_id?: string;
      service_category?: string;
      feature?: 'facilitated_onboarding' | 'economic_incentive' | 'service_catalog_suggestion' | 'b2b_capacity_market' | 'strategic_vouchers';
    };
  }>('/regional-expansion/unlocks', {
    // Rota protegida (listar desbloqueios disponíveis)
  }, async (req, reply) => {
    try {
      const { region_id, service_category, feature } = req.query;

      const unlocks = marketplaceService.getAvailableExpansionUnlocks({
        regionId: region_id,
        serviceCategory: service_category,
        feature: feature as any,
      });

      return reply.status(200).send({ unlocks });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao listar desbloqueios de expansão', error);
      return reply.status(400).send({ error: error.message || 'Erro ao listar desbloqueios' });
    }
  });

  // POST /marketplace/regional-expansion/unlocks/:unlockId/consume
  fastify.post<{
    Params: { unlockId: string };
  }>('/regional-expansion/unlocks/:unlockId/consume', {
    // Rota protegida (consumir desbloqueio)
  }, async (req, reply) => {
    try {
      const { unlockId } = req.params;
      const unlock = marketplaceService.consumeExpansionUnlock(unlockId);
      if (!unlock) {
        return reply.status(404).send({ error: 'Desbloqueio não encontrado' });
      }
      return reply.status(200).send(unlock);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao consumir desbloqueio', error);
      return reply.status(400).send({ error: error.message || 'Erro ao consumir desbloqueio' });
    }
  });

  // GET /marketplace/regional-expansion/summary/:regionId
  fastify.get<{
    Params: { regionId: string };
  }>('/regional-expansion/summary/:regionId', {
    // Rota protegida (obter resumo de expansão para uma região)
  }, async (req, reply) => {
    try {
      const { regionId } = req.params;
      const summary = marketplaceService.getRegionalExpansionSummary(regionId);
      return reply.status(200).send(summary);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar resumo de expansão', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar resumo' });
    }
  });

  // GET /marketplace/regional-expansion/check-feature
  fastify.get<{
    Querystring: {
      region_id: string;
      service_category: string;
      feature: 'facilitated_onboarding' | 'economic_incentive' | 'service_catalog_suggestion' | 'b2b_capacity_market' | 'strategic_vouchers';
    };
  }>('/regional-expansion/check-feature', {
    // Rota protegida (verificar se funcionalidade está desbloqueada)
  }, async (req, reply) => {
    try {
      const { region_id, service_category, feature } = req.query;

      if (!region_id || !service_category || !feature) {
        return reply.status(400).send({ error: 'region_id, service_category e feature são obrigatórios' });
      }

      const isUnlocked = marketplaceService.isFeatureUnlocked(
        region_id,
        service_category,
        feature as any
      );

      return reply.status(200).send({ is_unlocked: isUnlocked });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao verificar funcionalidade desbloqueada', error);
      return reply.status(400).send({ error: error.message || 'Erro ao verificar funcionalidade' });
    }
  });

  // ============================================================
  // PRECIFICAÇÃO ASSISTIDA (PRIVADA, NÃO PRESCRITIVA) (PROMPT 15)
  // ============================================================

  // POST /marketplace/stores/:storeId/operational-cost-profile
  fastify.post<{
    Params: { storeId: string };
    Body: {
      company_id: string;
      fixed_costs_monthly?: {
        rent?: { amountCents: number; currency: string };
        salaries?: { amountCents: number; currency: string };
        pro_labore?: { amountCents: number; currency: string };
        systems?: { amountCents: number; currency: string };
        other?: { amountCents: number; currency: string };
      };
      variable_costs_per_service?: {
        materials?: { amountCents: number; currency: string };
        commission?: { amountCents: number; currency: string };
        transportation?: { amountCents: number; currency: string };
        other?: { amountCents: number; currency: string };
      };
      costs_per_hour?: {
        fixed_cost_per_hour?: { amountCents: number; currency: string };
        variable_cost_per_hour?: { amountCents: number; currency: string };
      };
    };
  }>('/stores/:storeId/operational-cost-profile', {
    // Rota protegida (configurar perfil de custo operacional)
  }, async (req, reply) => {
    try {
      const { storeId } = req.params;
      const { company_id, ...profile } = req.body;

      if (!company_id) {
        return reply.status(400).send({ error: 'company_id é obrigatório' });
      }

      const costProfile = marketplaceService.setOperationalCostProfile(storeId, company_id, profile);
      return reply.status(201).send(costProfile);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao configurar perfil de custo operacional', error);
      return reply.status(400).send({ error: error.message || 'Erro ao configurar perfil' });
    }
  });

  // GET /marketplace/stores/:storeId/operational-cost-profile
  fastify.get<{
    Params: { storeId: string };
  }>('/stores/:storeId/operational-cost-profile', {
    // Rota protegida (buscar perfil de custo operacional)
  }, async (req, reply) => {
    try {
      const { storeId } = req.params;
      const costProfile = marketplaceService.getOperationalCostProfile(storeId);
      if (!costProfile) {
        return reply.status(404).send({ error: 'Perfil de custo operacional não encontrado' });
      }
      return reply.status(200).send(costProfile);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar perfil de custo operacional', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar perfil' });
    }
  });

  // POST /marketplace/stores/:storeId/pricing-assistance-report
  fastify.post<{
    Params: { storeId: string };
    Body: {
      company_id: string;
      actor_id: string; // Dono/gestor que pode ver este relatório
      period: {
        start: string;
        end: string;
      };
    };
  }>('/stores/:storeId/pricing-assistance-report', {
    // Rota protegida (gerar relatório de precificação assistida)
  }, async (req, reply) => {
    try {
      const { storeId } = req.params;
      const { company_id, actor_id, period } = req.body;

      if (!company_id || !actor_id || !period.start || !period.end) {
        return reply.status(400).send({ error: 'company_id, actor_id e period são obrigatórios' });
      }

      const report = marketplaceService.generatePricingAssistanceReport(
        storeId,
        company_id,
        actor_id,
        period
      );

      return reply.status(201).send(report);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao gerar relatório de precificação assistida', error);
      return reply.status(400).send({ error: error.message || 'Erro ao gerar relatório' });
    }
  });

  // GET /marketplace/pricing-assistance-reports/:reportId
  fastify.get<{
    Params: { reportId: string };
    Querystring: {
      actor_id: string; // Dono/gestor que pode ver este relatório
    };
  }>('/pricing-assistance-reports/:reportId', {
    // Rota protegida (buscar relatório de precificação assistida)
  }, async (req, reply) => {
    try {
      const { reportId } = req.params;
      const { actor_id } = req.query as { actor_id: string };

      if (!actor_id) {
        return reply.status(400).send({ error: 'actor_id é obrigatório' });
      }

      const report = marketplaceService.getPricingAssistanceReport(reportId, actor_id);
      if (!report) {
        return reply.status(404).send({ error: 'Relatório não encontrado' });
      }
      return reply.status(200).send(report);
    } catch (error: any) {
      marketplaceLogger.error('Erro ao buscar relatório de precificação assistida', error);
      return reply.status(400).send({ error: error.message || 'Erro ao buscar relatório' });
    }
  });

  // GET /marketplace/stores/:storeId/pricing-assistance-reports
  fastify.get<{
    Params: { storeId: string };
    Querystring: {
      actor_id: string;
      starts_at?: string;
      ends_at?: string;
    };
  }>('/stores/:storeId/pricing-assistance-reports', {
    // Rota protegida (listar relatórios de precificação assistida)
  }, async (req, reply) => {
    try {
      const { storeId } = req.params;
      const { actor_id, starts_at, ends_at } = req.query as {
        actor_id: string;
        starts_at?: string;
        ends_at?: string;
      };

      if (!actor_id) {
        return reply.status(400).send({ error: 'actor_id é obrigatório' });
      }

      const reports = marketplaceService.listPricingAssistanceReports({
        storeId: storeId,
        actorId: actor_id,
        starts_at,
        ends_at,
      });

      return reply.status(200).send({ reports });
    } catch (error: any) {
      marketplaceLogger.error('Erro ao listar relatórios de precificação assistida', error);
      return reply.status(400).send({ error: error.message || 'Erro ao listar relatórios' });
    }
  });
};

export default marketplaceRoutes;





