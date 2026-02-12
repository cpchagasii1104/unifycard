// backend/src/modules/venue/venue.routes.ts
// SPRINT 92: MENU + COMANDA (TAB) + QR ORDERING

import type { FastifyInstance } from 'fastify';
import { venueMenuService } from './venue-menu.service';
import { tabService } from './tab.service';
import { resolveActiveActorFromRequest } from '@modules/social/actor.utils';
import { contactService } from '../marketplace/contact.service';
import { orderService } from '../marketplace/order.service';
import { paymentIntentService } from '../marketplace/payment-intent.service';
import { paymentExecutionService } from '../marketplace/payment-execution.service';
import { publicProfileService } from '../public-profiles/public-profile.service';

/**
 * Rotas ADMIN/AUTH para Venue
 */
const venueAdminRoutes = async (fastify: FastifyInstance) => {
  // ============================================================
  // MENU
  // ============================================================

  /**
   * POST /venue/menus
   * Cria menu
   */
  fastify.post<{
    Body: {
      actorId: string;
      name: string;
      isActive?: boolean;
      metadata?: Record<string, any>;
    };
  }>('/menus', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { actorId, name, isActive, metadata } = req.body;

    const menu = await venueMenuService.createMenu(tenantId, actorId, {
      actorId,
      name,
      isActive,
      metadata,
    });

    return reply.status(201).send(menu);
  });

  /**
   * POST /venue/menus/:id/items
   * Adiciona item ao menu
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      productVariantId: string;
      displayName: string;
      description?: string;
      isAvailable?: boolean;
      sortOrder?: number;
      metadata?: Record<string, any>;
    };
  }>('/menus/:id/items', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const menuId = req.params.id;
    const { productVariantId, displayName, description, isAvailable, sortOrder, metadata } = req.body;

    const item = await venueMenuService.addMenuItem(tenantId, menuId, {
      productVariantId,
      displayName,
      description,
      isAvailable,
      sortOrder,
      metadata,
    });

    return reply.status(201).send(item);
  });

  /**
   * PATCH /venue/menus/items/:itemId/availability
   * Altera disponibilidade do item
   */
  fastify.patch<{
    Params: { itemId: string };
    Body: { isAvailable: boolean };
  }>('/menus/items/:itemId/availability', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const itemId = req.params.itemId;
    const { isAvailable } = req.body;

    await venueMenuService.setItemAvailability(tenantId, itemId, isAvailable);

    return reply.send({ success: true });
  });

  /**
   * GET /venue/menus/active?actorId=...
   * Lista menu ativo
   */
  fastify.get<{
    Querystring: { actorId: string };
  }>('/menus/active', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { actorId } = req.query;

    if (!actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    const menu = await venueMenuService.listActiveMenu(tenantId, actorId);

    return reply.send(menu);
  });

  // ============================================================
  // TABS
  // ============================================================

  /**
   * POST /venue/tabs/open
   * Abre comanda
   */
  fastify.post<{
    Body: {
      actorId: string;
      tableLabel?: string;
      contactId?: string;
      metadata?: Record<string, any>;
    };
  }>('/tabs/open', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { actorId, tableLabel, contactId, metadata } = req.body;

    const actor = await resolveActiveActorFromRequest(req, tenantId, {
      allowUserFallback: true,
      userId: req.user?.id,
    });

    const tab = await tabService.openTab(
      tenantId,
      { actorId, tableLabel, metadata },
      contactId,
      req.user?.id || null
    );

    return reply.status(201).send(tab);
  });

  /**
   * GET /venue/tabs?actorId=...&status=OPEN
   * Lista comandas
   */
  fastify.get<{
    Querystring: {
      actorId?: string;
      status?: 'OPEN' | 'CLOSED' | 'CANCELLED';
      limit?: number;
      offset?: number;
    };
  }>('/tabs', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query;

    const filters: any = {};
    if (query.actorId) filters.actorId = query.actorId;
    if (query.status) filters.status = query.status;
    if (query.limit) filters.limit = parseInt(query.limit as string, 10);
    if (query.offset) filters.offset = parseInt(query.offset as string, 10);

    const tabs = await tabService.listTabs(tenantId, filters);

    return reply.send({ tabs });
  });

  /**
   * POST /venue/tabs/:id/close
   * Fecha comanda
   */
  fastify.post<{ Params: { id: string } }>('/tabs/:id/close', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const tabId = req.params.id;

    const tab = await tabService.closeTab(tenantId, tabId);

    return reply.send(tab);
  });

  /**
   * POST /venue/tabs/:id/orders
   * Cria order e vincula à comanda
   */
  fastify.post<{ Params: { id: string } }>('/tabs/:id/orders', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const tabId = req.params.id;

    const result = await tabService.createOrderForTab(tenantId, tabId);

    return reply.status(201).send(result);
  });
};

/**
 * Rotas PÚBLICAS para Venue (sem auth)
 */
const venuePublicRoutes = async (fastify: FastifyInstance) => {
  /**
   * GET /v/:slug/menu
   * Retorna menu ativo do estabelecimento (read-only)
   */
  fastify.get<{ Params: { slug: string } }>('/v/:slug/menu', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { slug } = req.params;

    // Resolver actorId pelo public profile
    const profile = await publicProfileService.getBySlug(tenantId, slug);
    if (!profile) {
      return reply.status(404).send({ error: 'Estabelecimento não encontrado' });
    }

    try {
      const menu = await venueMenuService.listActiveMenu(tenantId, profile.actorId);
      return reply.send(menu);
    } catch (error: any) {
      if (error.message.includes('não encontrado')) {
        return reply.status(404).send({ error: 'Menu não encontrado' });
      }
      throw error;
    }
  });

  /**
   * POST /v/:slug/tabs/open
   * Abre comanda (público, rate limit)
   */
  fastify.post<{
    Params: { slug: string };
    Body: {
      tableLabel?: string;
      contact?: {
        name: string;
        email?: string;
        phone?: string;
        taxId?: string;
      };
    };
  }>('/v/:slug/tabs/open', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { slug } = req.params;
    const { tableLabel, contact } = req.body;

    // Resolver actorId pelo public profile
    const profile = await publicProfileService.getBySlug(tenantId, slug);
    if (!profile) {
      return reply.status(404).send({ error: 'Estabelecimento não encontrado' });
    }

    // Criar ou buscar contact se fornecido
    let contactId: string | undefined;
    if (contact) {
      try {
        const existing = contact.taxId
          ? await contactService.getContactByTaxId(tenantId, contact.taxId)
          : null;

        if (existing) {
          contactId = existing.id;
        } else {
          const newContact = await contactService.createContact(
            tenantId,
            {
              type: contact.taxId && contact.taxId.length === 14 ? 'COMPANY' : 'PERSON',
              name: contact.name,
              email: contact.email || null,
              phone: contact.phone || null,
              taxId: contact.taxId || null,
            },
            profile.actorId, // Usar actor do estabelecimento como criador
            null
          );
          contactId = newContact.id;
        }
      } catch (contactError) {
        // Log mas não bloqueia criação de tab
        console.warn('[Venue] Erro ao criar contact:', contactError);
      }
    }

    const tab = await tabService.openTab(
      tenantId,
      {
        actorId: profile.actorId,
        tableLabel,
      },
      contactId,
      undefined
    );

    return reply.status(201).send({ qrToken: tab.qrToken, tabId: tab.id });
  });

  /**
   * GET /t/:qrToken
   * Retorna status da comanda (read-only, público)
   */
  fastify.get<{ Params: { qrToken: string } }>('/t/:qrToken', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { qrToken } = req.params;

    const tab = await tabService.getTabByToken(tenantId, qrToken);
    if (!tab) {
      return reply.status(404).send({ error: 'Comanda não encontrada' });
    }

    // Buscar orders vinculados
    const tabWithOrders = await tabService.getTabWithOrders(tenantId, tab.id);

    // Buscar informações dos orders
    const { orderRepository } = await import('../marketplace/order.repository');
    const orders = [];
    for (const tabOrder of tabWithOrders.orders) {
      const order = await orderRepository.getOrderById(tenantId, tabOrder.orderId);
      if (order) {
        orders.push({
          id: order.id,
          status: order.status,
          totalQuantity: order.totalQuantity,
          createdAt: order.createdAt,
        });
      }
    }

    return reply.send({
      tab: {
        id: tab.id,
        tableLabel: tab.tableLabel,
        status: tab.status,
        openedAt: tab.openedAt,
      },
      orders,
    });
  });

  /**
   * POST /t/:qrToken/orders
   * Cria order vinculado à comanda (público, rate limit)
   */
  fastify.post<{ Params: { qrToken: string } }>('/t/:qrToken/orders', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { qrToken } = req.params;

    const tab = await tabService.getTabByToken(tenantId, qrToken);
    if (!tab) {
      return reply.status(404).send({ error: 'Comanda não encontrada' });
    }

    if (tab.status !== 'OPEN') {
      return reply.status(400).send({ error: 'Comanda não está aberta' });
    }

    const result = await tabService.createOrderForTab(tenantId, tab.id);

    return reply.status(201).send(result);
  });

  /**
   * POST /t/:qrToken/orders/:orderId/items
   * Adiciona item ao order (público, rate limit)
   */
  fastify.post<{
    Params: { qrToken: string; orderId: string };
    Body: {
      productVariantId: string;
      quantity: number;
      unit?: string;
    };
  }>('/t/:qrToken/orders/:orderId/items', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { qrToken, orderId } = req.params;
    const { productVariantId, quantity, unit } = req.body;

    // Validar tab existe e order pertence à tab
    const tab = await tabService.getTabByToken(tenantId, qrToken);
    if (!tab) {
      return reply.status(404).send({ error: 'Comanda não encontrada' });
    }

    const tabWithOrders = await tabService.getTabWithOrders(tenantId, tab.id);
    const orderBelongsToTab = tabWithOrders.orders.some((o) => o.orderId === orderId);
    if (!orderBelongsToTab) {
      return reply.status(403).send({ error: 'Order não pertence a esta comanda' });
    }

    // Adicionar item (reserva estoque automaticamente)
    const item = await orderService.addItem(tenantId, orderId, {
      productVariantId,
      quantity,
      unit: unit || 'un',
    }, 'PDV'); // Usar PDV como source para venue orders

    return reply.status(201).send(item);
  });

  /**
   * POST /t/:qrToken/orders/:orderId/submit
   * Submete order (público, rate limit)
   */
  fastify.post<{ Params: { qrToken: string; orderId: string } }>('/t/:qrToken/orders/:orderId/submit', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { qrToken, orderId } = req.params;

    // Validar tab e order
    const tab = await tabService.getTabByToken(tenantId, qrToken);
    if (!tab) {
      return reply.status(404).send({ error: 'Comanda não encontrada' });
    }

    const tabWithOrders = await tabService.getTabWithOrders(tenantId, tab.id);
    const orderBelongsToTab = tabWithOrders.orders.some((o) => o.orderId === orderId);
    if (!orderBelongsToTab) {
      return reply.status(403).send({ error: 'Order não pertence a esta comanda' });
    }

    // Submeter order
    const order = await orderService.submitOrder(tenantId, orderId);

    return reply.send(order);
  });

  /**
   * POST /t/:qrToken/orders/:orderId/pay
   * Pagar agora (PIX/UNIFYCARD) (público, rate limit)
   */
  fastify.post<{
    Params: { qrToken: string; orderId: string };
    Body: {
      paymentMethod: 'PIX' | 'UNIFYCARD';
      paymentMethodId?: string;
    };
  }>('/t/:qrToken/orders/:orderId/pay', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { qrToken, orderId } = req.params;
    const { paymentMethod, paymentMethodId } = req.body;

    // Validar tab e order
    const tab = await tabService.getTabByToken(tenantId, qrToken);
    if (!tab) {
      return reply.status(404).send({ error: 'Comanda não encontrada' });
    }

    const tabWithOrders = await tabService.getTabWithOrders(tenantId, tab.id);
    const orderBelongsToTab = tabWithOrders.orders.some((o) => o.orderId === orderId);
    if (!orderBelongsToTab) {
      return reply.status(403).send({ error: 'Order não pertence a esta comanda' });
    }

    // Buscar order
    const { orderRepository } = await import('../marketplace/order.repository');
    const order = await orderRepository.getOrderById(tenantId, orderId);
    if (!order) {
      return reply.status(404).send({ error: 'Order não encontrado' });
    }

    if (order.status !== 'SUBMITTED') {
      return reply.status(400).send({ error: `Order não está em SUBMITTED (status: ${order.status})` });
    }

    // Criar PaymentIntent
    const intent = await paymentIntentService.createPaymentIntent(tenantId, {
      orderId: order.id,
      paymentMethodId,
      metadata: {
        source: 'VENUE_QR',
        tab_id: tab.id,
        qr_token: qrToken,
        contact_id: tab.openedByContactId,
        payerContactId: tab.openedByContactId,
      },
    });

    // Autorizar PaymentIntent
    const authorizedIntent = await paymentIntentService.authorizePaymentIntent(tenantId, intent.id);

    // Executar pagamento
    const transaction = await paymentExecutionService.executePayment(tenantId, {
      paymentIntentId: authorizedIntent.id,
      buyerActorId: order.buyerActorId,
      sellerActorId: order.sellerActorId,
    });

    // SPRINT 93: Buscar pontos ganhos se pagamento foi SUCCESS
    let earnedPoints = 0;
    if (transaction.status === 'SUCCESS' && tab.openedByContactId) {
      try {
        const { loyaltyService } = await import('../loyalty/loyalty.service');
        const balance = await loyaltyService.getBalance(tenantId, tab.openedByContactId);
        // Por enquanto, retornar apenas o saldo atual (futuro: retornar pontos ganhos nesta transação)
        earnedPoints = balance;
      } catch (loyaltyError) {
        // Log mas não bloqueia resposta
        console.warn('[Venue] Erro ao buscar pontos de fidelidade:', loyaltyError);
      }
    }

    return reply.send({
      paymentIntentId: authorizedIntent.id,
      transactionId: transaction.id,
      status: transaction.status,
      paymentMethod: transaction.paymentMethod,
      // Se PIX, retornar QR code no metadata
      pixQrCode: transaction.metadata?.pixQrCode || null,
      // SPRINT 93: Pontos ganhos
      earnedPoints,
    });
  });
};

export { venueAdminRoutes, venuePublicRoutes };

