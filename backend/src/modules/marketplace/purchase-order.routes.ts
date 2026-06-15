// backend/src/modules/marketplace/purchase-order.routes.ts
// SPRINT 69: Rotas REST para Purchase Orders
// 🔒 F-C1-MONEY-PO-OWNER-ACTOR-SCHEMA-WIRING (DECISION-0131 · decisão Clayton): purchase_order pertence ao
// lado COMPRADOR via owner_actor_id = actor operacional da empresa (page+company_id). Toda operação exige que
// req.user REPRESENTE o owner empresarial (canRepresentActor); created_by_actor_id = autoria, supplier_id =
// contraparte, tenant_id = escopo — NUNCA autoridade. receivePO segue CONTIDO (frente anterior).

import type { FastifyInstance, FastifyReply } from 'fastify';
import { purchaseOrderService } from './purchase-order.service';
import type {
  CreatePurchaseOrderInput,
  AddPurchaseOrderItemInput,
  PurchaseOrderFilters,
  PurchaseOrder,
} from './purchase-order.types';
import { BadRequestError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';
import { authorizationService } from '@core/authorization/authorization.service';
import { runQueriesWithTenant } from '@core/database/pool';

// owner empresarial OPERACIONAL = actor_type='page' AND company_id IS NOT NULL (§4.38; o company-actor da empresa).
// Rejeita actor humano (user/actor_human/person) e qualquer actor sem company_id. Read puro (sem write).
async function isOrgActor(tenantId: string, actorId: string): Promise<boolean> {
  const rows = await runQueriesWithTenant<{ actor_type: string; company_id: string | null }>(
    tenantId,
    `SELECT actor_type, company_id FROM actors WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [tenantId, actorId]
  );
  const a = rows[0];
  return !!a && a.actor_type === 'page' && a.company_id != null;
}

// Carrega o PO e exige que req.user represente o owner empresarial. 404 ausente · 403 sem autoridade.
async function loadAndAuthorizePO(
  reply: FastifyReply,
  tenantId: string,
  userId: string,
  orderId: string
): Promise<PurchaseOrder | null> {
  const order = await purchaseOrderService.getPOById(tenantId, orderId);
  if (!order) {
    reply.status(404).send({ error: 'Ordem não encontrada' });
    return null;
  }
  const canRep = await authorizationService.canRepresentActor(tenantId, userId, order.ownerActorId);
  if (!canRep) {
    reply.status(403).send({ error: 'Caller must represent the buyer company (owner_actor_id) of this purchase order.' });
    return null;
  }
  return order;
}

const purchaseOrderRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /purchase-orders
   * Cria ordem de compra (status: DRAFT) — exige owner empresarial representável.
   */
  fastify.post<{ Body: CreatePurchaseOrderInput }>('/purchase-orders', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const userId = req.user?.userId;
    const actionContext = (req as any).actionContext;

    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    if (!actionContext?.actorId) {
      throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
    }

    // 🔒 owner empresarial: HINT (body.ownerActorId OU actionContext.actorId), resolvido e validado server-side.
    const ownerHint = (req.body?.ownerActorId as string | undefined) || actionContext.actorId;
    if (!ownerHint) {
      return reply.status(400).send({ error: 'owner_actor_id (empresa compradora) é obrigatório' });
    }
    if (!(await isOrgActor(tenantId, ownerHint))) {
      return reply.status(403).send({
        error: 'owner_actor_id deve ser um actor de EMPRESA (page + company_id). Actor humano/person/user, supplier ou tenant não podem ser owner de purchase_order.',
      });
    }
    if (!(await authorizationService.canRepresentActor(tenantId, userId, ownerHint))) {
      return reply.status(403).send({ error: 'Caller must represent the buyer company (owner_actor_id) to create a purchase order.' });
    }

    const order = await purchaseOrderService.createPO(
      tenantId,
      { ...req.body, ownerActorId: ownerHint }, // owner DERIVADO server-side (body é só hint)
      actionContext.actorId,        // created_by_actor_id = autoria (não autoridade)
      actionContext.actingUserId
    );

    return reply.status(201).send(order);
  });

  /**
   * GET /purchase-orders — lista SOMENTE POs cujo owner empresarial o usuário representa (tenant-only não basta).
   */
  fastify.get('/purchase-orders', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const userId = req.user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    const query = req.query as any;

    const filters: PurchaseOrderFilters = {};
    if (query.supplierId) filters.supplierId = query.supplierId;
    if (query.status) filters.status = query.status as any;
    if (query.orderDateFrom) filters.orderDateFrom = query.orderDateFrom;
    if (query.orderDateTo) filters.orderDateTo = query.orderDateTo;
    if (query.limit) filters.limit = parseInt(query.limit);
    if (query.offset) filters.offset = parseInt(query.offset);

    const all = await purchaseOrderService.listPOs(tenantId, filters);
    const repCache = new Map<string, boolean>();
    const orders: PurchaseOrder[] = [];
    for (const o of all) {
      if (!repCache.has(o.ownerActorId)) {
        repCache.set(o.ownerActorId, await authorizationService.canRepresentActor(tenantId, userId, o.ownerActorId));
      }
      if (repCache.get(o.ownerActorId)) orders.push(o);
    }
    return { orders };
  });

  /**
   * GET /purchase-orders/:id — somente se o usuário representa o owner empresarial.
   */
  fastify.get<{ Params: { id: string } }>('/purchase-orders/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const userId = req.user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    const order = await loadAndAuthorizePO(reply, tenantId, userId, req.params.id);
    if (!order) return;
    return order;
  });

  /**
   * GET /purchase-orders/:id/items — somente se o usuário representa o owner empresarial.
   */
  fastify.get<{ Params: { id: string } }>('/purchase-orders/:id/items', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const userId = req.user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    const order = await loadAndAuthorizePO(reply, tenantId, userId, req.params.id);
    if (!order) return;
    const items = await purchaseOrderService.getItemsByOrderId(tenantId, req.params.id);
    return { items };
  });

  /**
   * POST /purchase-orders/:id/items — somente se o usuário representa o owner empresarial.
   */
  fastify.post<{ Params: { id: string }; Body: AddPurchaseOrderItemInput }>(
    '/purchase-orders/:id/items',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;
      const userId = req.user?.userId;
      const actionContext = (req as any).actionContext;

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }
      if (!actionContext?.actorId) {
        throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
      }
      const order = await loadAndAuthorizePO(reply, tenantId, userId, id);
      if (!order) return;

      const item = await purchaseOrderService.addItem(
        tenantId,
        id,
        req.body,
        actionContext.actorId, // autoria
        actionContext.actingUserId
      );

      return reply.status(201).send(item);
    }
  );

  /**
   * POST /purchase-orders/:id/submit — somente se o usuário representa o owner empresarial.
   * submitted_by_actor_id continua autoria, não autoridade.
   */
  fastify.post<{ Params: { id: string } }>('/purchase-orders/:id/submit', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;
    const userId = req.user?.userId;
    const actionContext = (req as any).actionContext;

    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    if (!actionContext?.actorId) {
      throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
    }
    const order = await loadAndAuthorizePO(reply, tenantId, userId, id);
    if (!order) return;

    return purchaseOrderService.submitPO(tenantId, id, actionContext.actorId, actionContext.actingUserId);
  });

  /**
   * POST /purchase-orders/:id/cancel — somente se o usuário representa o owner empresarial.
   * cancelled_by_actor_id continua autoria, não autoridade.
   */
  fastify.post<{ Params: { id: string }; Body: { cancellationReason?: string } }>(
    '/purchase-orders/:id/cancel',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;
      const userId = req.user?.userId;
      const actionContext = (req as any).actionContext;

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }
      if (!actionContext?.actorId) {
        throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
      }
      const order = await loadAndAuthorizePO(reply, tenantId, userId, id);
      if (!order) return;

      return purchaseOrderService.cancelPO(
        tenantId,
        id,
        actionContext.actorId, // autoria
        actionContext.actingUserId,
        req.body.cancellationReason
      );
    }
  );

  /**
   * POST /purchase-orders/:id/receive
   * 🔒 F-C1-MONEY-PO-RECEIVE-EXPLICIT-CONTAINMENT: a rota é EXPLICITAMENTE contida (fail-closed 403) ANTES de
   * qualquer leitura/checagem — espelha o hard-stop do service (purchaseOrderService.receivePO), que é a
   * contenção primária (protege qualquer caller alternativo/futuro). Recebimento de PO só será reabilitado quando
   * purchase_order tiver OWNER EMPRESARIAL MATERIAL com fluxo de recebimento próprio. actionContext/
   * created_by_actor_id NÃO autorizam. Não move estoque, não muda status, não cria conta a pagar.
   */
  fastify.post<{ Params: { id: string } }>('/purchase-orders/:id/receive', async (_req, reply) => {
    return reply.status(403).send({
      error: 'PURCHASE_ORDER_RECEIVE_CONTAINED',
      message: 'Recebimento de purchase_order está contido (fail-closed) até existir owner empresarial material (company-owned). Ref: F-C1-MONEY-PO-RECEIVE-EXPLICIT-CONTAINMENT.',
    });
  });
};

export default purchaseOrderRoutes;
