// backend/src/modules/pdv/pdv.routes.ts
// SPRINT 42.1: PDV CORE - Rotas para PDV

import { FastifyPluginAsync } from 'fastify';
import { requirePermission } from '@core/authorization/require-permission.guard';
import { pdvService } from './pdv.service';
import { auditService } from '@core/audit/audit.service';
import type {
  CreatePdvSessionInput,
  ClosePdvSessionInput,
  CreateOrderFromPdvInput,
  AddItemByVariantInput,
  AddItemByWeightInput,
  PayOrderFromPdvInput,
} from './pdv.types';

const pdvRoutes: FastifyPluginAsync = async (fastify) => {
  // Middleware para todas as rotas do PDV
  fastify.addHook('preHandler', async (req, reply) => {
    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant ID is required' });
    }
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
  });

  // ============================================================
  // SESSÕES PDV
  // ============================================================

  // POST /pdv/sessions/open
  fastify.post<{ Body: CreatePdvSessionInput }>(
    '/sessions/open',
    { preHandler: [requirePermission('marketplace_manage_orders')] },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const actionContext = (req as any).actionContext;
      const input = req.body;

      // ActionContext é obrigatório (V2)
      if (!actionContext || !actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      // Usar actorId do ActionContext se não fornecido
      const sessionInput: CreatePdvSessionInput = {
        actorId: actionContext.actorId,
        metadata: input.metadata,
      };

      const session = await pdvService.openSession(tenantId, sessionInput);

      // Registrar auditoria
      await auditService.record(tenantId, {
        event_type: 'PDV_SESSION_OPENED',
        severity: 'info',
        actor_id: session.actorId,
        actor_type: 'user',
        source: 'pdv',
        context: { session_id: session.id, opened_by: actionContext.actorId },
      });

      return reply.status(201).send(session);
    }
  );

  // POST /pdv/sessions/:id/close
  fastify.post<{ Params: { id: string }; Body: ClosePdvSessionInput }>(
    '/sessions/:id/close',
    { preHandler: [requirePermission('marketplace_manage_orders')] },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;
      const actionContext = (req as any).actionContext;
      const input = req.body || {};

      const session = await pdvService.closeSession(tenantId, id, input);

      // Registrar auditoria
      await auditService.record(tenantId, {
        event_type: 'PDV_SESSION_CLOSED',
        severity: 'info',
        actor_id: session.actorId,
        actor_type: 'user',
        source: 'pdv',
        context: { session_id: session.id, closed_by: actionContext.actorId },
      });

      return session;
    }
  );

  // GET /pdv/sessions/open
  fastify.get('/sessions/open', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    const session = await pdvService.getOpenSessionByActor(
      tenantId,
      actionContext.actorId
    );

    return { session };
  });

  // GET /pdv/sessions
  fastify.get('/sessions', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    const sessions = await pdvService.listSessionsByActor(
      tenantId,
      actionContext.actorId
    );

    return { sessions };
  });

  // GET /pdv/sessions/:id/summary
  fastify.get<{ Params: { id: string } }>('/sessions/:id/summary', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;

    const summary = await pdvService.getSessionSummary(tenantId, id);
    return summary;
  });

  // POST /pdv/sessions/:id/close-with-summary
  fastify.post<{ Params: { id: string } }>(
    '/sessions/:id/close-with-summary',
    { preHandler: [requirePermission('marketplace_manage_orders')] },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;
      const actionContext = (req as any).actionContext;

      const summary = await pdvService.closeSessionWithSummary(tenantId, id);

      // Registrar auditoria
      await auditService.record(tenantId, {
        event_type: 'PDV_SESSION_CLOSED_WITH_SUMMARY',
        severity: 'info',
        actor_id: summary.operator.actorId,
        actor_type: 'user',
        source: 'pdv',
        context: {
          session_id: id,
          total_orders: summary.totalOrders,
          total_paid: summary.totalPaid,
          total_failed: summary.totalFailed,
          closed_by: actionContext.actorId,
        },
      });

      return summary;
    }
  );

  // ============================================================
  // PEDIDOS DO PDV
  // ============================================================

  // POST /pdv/orders
  fastify.post<{ Body: CreateOrderFromPdvInput }>(
    '/orders',
    { preHandler: [requirePermission('marketplace_manage_orders')] },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const actionContext = (req as any).actionContext;
      const input = req.body;

      const order = await pdvService.createOrderFromPdv(tenantId, input);

      // Registrar auditoria
      await auditService.record(tenantId, {
        event_type: 'PDV_ORDER_CREATED',
        severity: 'info',
        actor_id: actionContext.actorId,
        actor_type: 'user',
        source: 'pdv',
        context: {
          order_id: order.id,
          session_id: input.sessionId,
          buyer_actor_id: input.buyerActorId,
          seller_actor_id: input.sellerActorId,
        },
      });

      return reply.status(201).send(order);
    }
  );

  // POST /pdv/orders/:orderId/items/unit
  fastify.post<{ Params: { orderId: string }; Body: AddItemByVariantInput }>(
    '/orders/:orderId/items/unit',
    { preHandler: [requirePermission('marketplace_manage_orders')] },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { orderId } = req.params;
      const actionContext = (req as any).actionContext;
      const input = { ...req.body, orderId };

      const item = await pdvService.addItemByVariant(tenantId, input);

      // Registrar auditoria
      await auditService.record(tenantId, {
        event_type: 'PDV_ITEM_ADDED',
        severity: 'info',
        actor_id: actionContext.actorId,
        actor_type: 'user',
        source: 'pdv',
        context: {
          order_id: orderId,
          item_id: item.id,
          variant_id: input.variantId,
          quantity: input.quantity,
          unit: input.unit || 'UN',
        },
      });

      return reply.status(201).send(item);
    }
  );

  // POST /pdv/orders/:orderId/items/weight
  fastify.post<{ Params: { orderId: string }; Body: AddItemByWeightInput }>(
    '/orders/:orderId/items/weight',
    { preHandler: [requirePermission('marketplace_manage_orders')] },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { orderId } = req.params;
      const actionContext = (req as any).actionContext;
      const input = { ...req.body, orderId };

      const item = await pdvService.addItemByWeight(tenantId, input);

      // Registrar auditoria
      await auditService.record(tenantId, {
        event_type: 'PDV_ITEM_ADDED_BY_WEIGHT',
        severity: 'info',
        actor_id: actionContext.actorId,
        actor_type: 'user',
        source: 'pdv',
        context: {
          order_id: orderId,
          item_id: item.id,
          variant_id: input.variantId,
          weight: input.weight,
          unit: input.unit || 'KG',
        },
      });

      return reply.status(201).send(item);
    }
  );

  // ============================================================
  // PAGAMENTO NO PDV
  // ============================================================

  // POST /pdv/orders/:orderId/pay
  fastify.post<{ Params: { orderId: string }; Body: PayOrderFromPdvInput }>(
    '/orders/:orderId/pay',
    { preHandler: [requirePermission('marketplace_execute_payments')] },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { orderId } = req.params;
      const actionContext = (req as any).actionContext;
      const input = { ...req.body, orderId };
      
      // SPRINT 42.2: Idempotência - aceitar header opcional Idempotency-Key
      const idempotencyKey = (req.headers['idempotency-key'] as string) || undefined;
      if (idempotencyKey) {
        input.idempotencyKey = idempotencyKey;
      }

      const result = await pdvService.payOrderFromPdv(tenantId, input);

      // Registrar auditoria
      await auditService.record(tenantId, {
        event_type: 'PDV_PAYMENT_EXECUTED',
        severity: 'MEDIUM',
        actor_id: actionContext.actorId,
        actor_type: 'user',
        source: 'pdv',
        context: {
          order_id: orderId,
          payment_intent_id: result.paymentIntent.id,
          transaction_id: result.transaction.id,
          amountCents: input.amount,
          session_id: input.sessionId,
        },
      });

      return reply.status(200).send(result);
    }
  );
};

export default pdvRoutes;


