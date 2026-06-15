// backend/src/modules/pdv/pdv.routes.ts
// SPRINT 42.1: PDV CORE - Rotas para PDV

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { requirePermission } from '@core/authorization/require-permission.guard';
import { orderService } from '../marketplace/order.service';
import { authorizationService } from '@core/authorization/authorization.service';
import { pdvService } from './pdv.service';
import { auditService } from '@core/audit/audit.service';
import type { AuditSeverity, AuditSource } from '@core/audit/audit.service';
import type {
  CreatePdvSessionInput,
  ClosePdvSessionInput,
  CreateOrderFromPdvInput,
  AddItemByVariantInput,
  AddItemByWeightInput,
  PayOrderFromPdvInput,
} from './pdv.types';

const pdvRoutes: FastifyPluginAsync = async (fastify) => {
  // 🔒 PDV-F2B (DECISION-0131 / 0113 canal-1 / Art.17): binding canônico de autoridade/autoria.
  // `actionContext.actorId` é HINT/seleção de actor operacional, NUNCA autoridade final. Toda rota
  // PDV prova server-side que `req.user` REPRESENTA o actor material da ação (operador da sessão OU
  // seller da ordem) via `canRepresentActor` ANTES de agir/ler. Sem representar → 403 fail-closed.
  // Retorna `false` (e já respondeu) quando nega; o handler deve `return` em seguida.
  const assertRepresents = async (
    req: FastifyRequest,
    reply: FastifyReply,
    tenantId: string,
    targetActorId: string
  ): Promise<boolean> => {
    const userId = (req as { user?: { id?: string } }).user?.id;
    if (!userId) {
      reply.status(401).send({ error: 'Authentication required' });
      return false;
    }
    const ok = await authorizationService.canRepresentActor(tenantId, userId, targetActorId);
    if (!ok) {
      reply.status(403).send({ error: 'Caller must represent the actor for this PDV action.' });
      return false;
    }
    return true;
  };

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

      // 🔒 PDV-F2B (Modelo A): o actor operacional declarado é HINT — req.user DEVE representá-lo.
      if (!(await assertRepresents(req, reply, tenantId, actionContext.actorId))) return;

      // Usar actorId do ActionContext (já provado representável) como operador da sessão.
      const sessionInput: CreatePdvSessionInput = {
        actorId: actionContext.actorId,
        metadata: input.metadata,
      };

      const session = await pdvService.openSession(tenantId, sessionInput);

      // Registrar auditoria — actor_id = operador VALIDADO (representabilidade provada).
      await auditService.record(tenantId, {
        event_type: 'PDV_SESSION_OPENED',
        severity: 'low' as AuditSeverity,
        actor_id: session.actorId,
        actor_type: 'user',
        source: 'impact' as AuditSource,
        context: { session_id: session.id, opened_by: session.actorId },
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
      const input = req.body || {};

      // 🔒 PDV-F2B (Modelo B): resolve o DONO da sessão (session.actor_id) e exige representá-lo.
      // 404 (ausente) ≠ 403 (sem autoridade). A autoridade NÃO vem do actionContext cru.
      const target = await pdvService.findSessionById(tenantId, id);
      if (!target) {
        return reply.status(404).send({ error: 'PDV session not found' });
      }
      if (!(await assertRepresents(req, reply, tenantId, target.actorId))) return;

      const session = await pdvService.closeSession(tenantId, id, input);

      // Registrar auditoria — actor_id/closed_by = operador VALIDADO da sessão.
      await auditService.record(tenantId, {
        event_type: 'PDV_SESSION_CLOSED',
        severity: 'low' as AuditSeverity,
        actor_id: session.actorId,
        actor_type: 'user',
        source: 'impact' as AuditSource,
        context: { session_id: session.id, closed_by: session.actorId },
      });

      return session;
    }
  );

  // GET /pdv/sessions/open
  fastify.get('/sessions/open', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // 🔒 PDV-F2B (Modelo A — reader): só lê sessões do actor que req.user representa (anti-spoof).
    if (!(await assertRepresents(req, reply, tenantId, actionContext.actorId))) return;

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

    // 🔒 PDV-F2B (Modelo A — reader): só lê sessões do actor que req.user representa (anti-spoof).
    if (!(await assertRepresents(req, reply, tenantId, actionContext.actorId))) return;

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

    // 🔒 PDV-F2B (Modelo B — reader): resolve o dono da sessão e exige representá-lo (anti-spoof por id).
    const target = await pdvService.findSessionById(tenantId, id);
    if (!target) {
      return reply.status(404).send({ error: 'PDV session not found' });
    }
    if (!(await assertRepresents(req, reply, tenantId, target.actorId))) return;

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

      // 🔒 PDV-F2B (Modelo B): resolve o dono da sessão (session.actor_id) e exige representá-lo.
      const target = await pdvService.findSessionById(tenantId, id);
      if (!target) {
        return reply.status(404).send({ error: 'PDV session not found' });
      }
      if (!(await assertRepresents(req, reply, tenantId, target.actorId))) return;

      const summary = await pdvService.closeSessionWithSummary(tenantId, id);

      // Registrar auditoria — actor_id/closed_by = operador VALIDADO.
      await auditService.record(tenantId, {
        event_type: 'PDV_SESSION_CLOSED_WITH_SUMMARY',
        severity: 'low' as AuditSeverity,
        actor_id: summary.operator.actorId,
        actor_type: 'user',
        source: 'impact' as AuditSource,
        context: {
          session_id: id,
          total_orders: summary.totalOrders,
          total_paid: summary.totalPaid,
          total_failed: summary.totalFailed,
          closed_by: summary.operator.actorId,
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
      const input = req.body;

      // 🔒 PDV-F2B (Modelo C): vínculo material = a SESSÃO. Sem sessionId resolvível → STOP (400);
      // com ela, resolve o operador (session.actor_id) e exige representá-lo. Autoria = operador validado.
      if (!input || !input.sessionId) {
        return reply.status(400).send({ error: 'sessionId is required to create a PDV order' });
      }
      const target = await pdvService.findSessionById(tenantId, input.sessionId);
      if (!target) {
        return reply.status(404).send({ error: 'PDV session not found' });
      }
      if (!(await assertRepresents(req, reply, tenantId, target.actorId))) return;

      const order = await pdvService.createOrderFromPdv(tenantId, input);

      // Registrar auditoria — actor_id = operador VALIDADO da sessão (não actionContext cru).
      await auditService.record(tenantId, {
        event_type: 'PDV_ORDER_CREATED',
        severity: 'low' as AuditSeverity,
        actor_id: target.actorId,
        actor_type: 'user',
        source: 'impact' as AuditSource,
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
      const input = { ...req.body, orderId };

      // 🔒 PDV-F2B (Modelo D): resolve a ORDEM server-side e exige representar o SELLER da ordem.
      const orderForAuth = await orderService.getOrderById(tenantId, orderId);
      if (!orderForAuth) {
        return reply.status(404).send({ error: 'Order not found' });
      }
      if (!(await assertRepresents(req, reply, tenantId, orderForAuth.sellerActorId))) return;

      const item = await pdvService.addItemByVariant(tenantId, input);

      // Registrar auditoria — actor_id = seller VALIDADO da ordem (não actionContext cru).
      await auditService.record(tenantId, {
        event_type: 'PDV_ITEM_ADDED',
        severity: 'low' as AuditSeverity,
        actor_id: orderForAuth.sellerActorId,
        actor_type: 'user',
        source: 'impact' as AuditSource,
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
      const input = { ...req.body, orderId };

      // 🔒 PDV-F2B (Modelo D): resolve a ORDEM server-side e exige representar o SELLER da ordem.
      const orderForAuth = await orderService.getOrderById(tenantId, orderId);
      if (!orderForAuth) {
        return reply.status(404).send({ error: 'Order not found' });
      }
      if (!(await assertRepresents(req, reply, tenantId, orderForAuth.sellerActorId))) return;

      const item = await pdvService.addItemByWeight(tenantId, input);

      // Registrar auditoria — actor_id = seller VALIDADO da ordem (não actionContext cru).
      await auditService.record(tenantId, {
        event_type: 'PDV_ITEM_ADDED_BY_WEIGHT',
        severity: 'low' as AuditSeverity,
        actor_id: orderForAuth.sellerActorId,
        actor_type: 'user',
        source: 'impact' as AuditSource,
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
      const input = { ...req.body, orderId };

      // SPRINT 42.2: Idempotência - aceitar header opcional Idempotency-Key
      const idempotencyKey = (req.headers['idempotency-key'] as string) || undefined;
      if (idempotencyKey) {
        input.idempotencyKey = idempotencyKey;
      }

      // 🔒 PDV-F2A (DECISION-0131 / 0113 canal-1 / Art.17): autoridade CANÔNICA por REPRESENTABILIDADE do
      // SELLER da ORDEM (server-side), ANTES de qualquer side-effect. actionContext.actorId / role /
      // capability NÃO autorizam sozinhos: req.user DEVE representar o vendedor da ordem. O seller é
      // resolvido da ORDEM (orderService.getOrderById), NUNCA do body. Sem representar o seller → 403.
      const payUserId = req.user?.id;
      if (!payUserId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }
      const orderForAuth = await orderService.getOrderById(tenantId, orderId);
      if (!orderForAuth) {
        return reply.status(404).send({ error: 'Order not found' });
      }
      const canRepresentSeller = await authorizationService.canRepresentActor(tenantId, payUserId, orderForAuth.sellerActorId);
      if (!canRepresentSeller) {
        return reply.status(403).send({ error: 'Caller must represent the order seller to process payment.' });
      }
      // Consistência: seller/buyer do body devem casar com a ORDEM (sem redirecionar dinheiro pelo body).
      if (input.sellerActorId !== orderForAuth.sellerActorId || input.buyerActorId !== orderForAuth.buyerActorId) {
        return reply.status(403).send({ error: 'Payment parties must match the order (seller/buyer).' });
      }

      const result = await pdvService.payOrderFromPdv(tenantId, input);

      // Registrar auditoria — PDV-F2B: actor_id = seller VALIDADO da ordem (não actionContext cru).
      await auditService.record(tenantId, {
        event_type: 'PDV_PAYMENT_EXECUTED',
        severity: 'medium',
        actor_id: orderForAuth.sellerActorId,
        actor_type: 'user',
        source: 'impact' as AuditSource,
        context: {
          order_id: orderId,
          payment_intent_id: result.paymentIntent.id,
          transaction_id: result.transaction.id,
          amountCents: input.amountCents,
          session_id: input.sessionId,
        },
      });

      return reply.status(200).send(result);
    }
  );
};

export default pdvRoutes;
