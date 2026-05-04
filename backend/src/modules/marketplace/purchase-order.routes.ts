// backend/src/modules/marketplace/purchase-order.routes.ts
// SPRINT 69: Rotas REST para Purchase Orders

import type { FastifyInstance } from 'fastify';
import { purchaseOrderService } from './purchase-order.service';
import type {
  CreatePurchaseOrderInput,
  AddPurchaseOrderItemInput,
  ReceivePurchaseOrderInput,
  PurchaseOrderFilters,
} from './purchase-order.types';
import { BadRequestError, NotFoundError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

const purchaseOrderRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /purchase-orders
   * Cria ordem de compra (status: DRAFT)
   */
  fastify.post<{ Body: CreatePurchaseOrderInput }>('/purchase-orders', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
    }

    const order = await purchaseOrderService.createPO(
      tenantId,
      req.body,
      actionContext.actorId,
      actionContext.actingUserId
    );

    return reply.status(201).send(order);
  });

  /**
   * GET /purchase-orders
   * Lista ordens de compra
   */
  fastify.get('/purchase-orders', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const filters: PurchaseOrderFilters = {};
    if (query.supplierId) filters.supplierId = query.supplierId;
    if (query.status) filters.status = query.status as any;
    if (query.orderDateFrom) filters.orderDateFrom = query.orderDateFrom;
    if (query.orderDateTo) filters.orderDateTo = query.orderDateTo;
    if (query.limit) filters.limit = parseInt(query.limit);
    if (query.offset) filters.offset = parseInt(query.offset);

    const orders = await purchaseOrderService.listPOs(tenantId, filters);
    return { orders };
  });

  /**
   * GET /purchase-orders/:id
   * Busca ordem por ID
   */
  fastify.get<{ Params: { id: string } }>('/purchase-orders/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;

    const order = await purchaseOrderService.getPOById(tenantId, id);
    if (!order) {
      throw new NotFoundError('Ordem não encontrada');
    }

    return order;
  });

  /**
   * GET /purchase-orders/:id/items
   * Lista itens de uma ordem
   */
  fastify.get<{ Params: { id: string } }>('/purchase-orders/:id/items', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;

    const items = await purchaseOrderService.getItemsByOrderId(tenantId, id);
    return { items };
  });

  /**
   * POST /purchase-orders/:id/items
   * Adiciona item à ordem
   */
  fastify.post<{ Params: { id: string }; Body: AddPurchaseOrderItemInput }>(
    '/purchase-orders/:id/items',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;
      const actionContext = (req as any).actionContext;

      if (!actionContext?.actorId) {
        throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
      }

      const item = await purchaseOrderService.addItem(
        tenantId,
        id,
        req.body,
        actionContext.actorId,
        actionContext.actingUserId
      );

      return reply.status(201).send(item);
    }
  );

  /**
   * POST /purchase-orders/:id/submit
   * Submete ordem ao fornecedor (DRAFT → SUBMITTED)
   */
  fastify.post<{ Params: { id: string } }>('/purchase-orders/:id/submit', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
    }

    const order = await purchaseOrderService.submitPO(
      tenantId,
      id,
      actionContext.actorId,
      actionContext.actingUserId
    );

    return order;
  });

  /**
   * POST /purchase-orders/:id/receive
   * Recebe ordem (SUBMITTED/RECEIVED → RECEIVED/COMPLETED)
   * Gera inventory_movements IN
   */
  fastify.post<{ Params: { id: string }; Body: ReceivePurchaseOrderInput }>(
    '/purchase-orders/:id/receive',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;
      const actionContext = (req as any).actionContext;

      if (!actionContext?.actingUserId) {
        throw new BadRequestError('actingUserId é obrigatório', ErrorCode.MISSING_ACTOR);
      }

      const result = await purchaseOrderService.receivePO(
        tenantId,
        id,
        req.body,
        actionContext.actingUserId
      );

      return result;
    }
  );

  /**
   * POST /purchase-orders/:id/cancel
   * Cancela ordem
   */
  fastify.post<{ Params: { id: string }; Body: { cancellationReason?: string } }>(
    '/purchase-orders/:id/cancel',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;
      const actionContext = (req as any).actionContext;

      if (!actionContext?.actorId) {
        throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
      }

      const order = await purchaseOrderService.cancelPO(
        tenantId,
        id,
        actionContext.actorId,
        actionContext.actingUserId,
        req.body.cancellationReason
      );

      return order;
    }
  );
};

export default purchaseOrderRoutes;
