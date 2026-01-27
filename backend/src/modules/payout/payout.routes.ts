// backend/src/modules/payout/payout.routes.ts
// Rotas para Payout Engine
// 🔴 BLINDAGEM: RBAC obrigatório (apenas FINANCE/OWNER/ADMIN)

import type { FastifyInstance } from 'fastify';
import { payoutService } from './payout.service';
import type { CreatePayoutBatchInput, ExecutePayoutManualInput, FailPayoutInput } from './payout.types';

const payoutRoutes = async (fastify: FastifyInstance) => {
  /**
   * Middleware: Verificar permissão para acessar payouts
   */
  const requirePayoutPermission = async (req: any, reply: any) => {
    const tenantId = req.tenant.id;
    const userId = req.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    try {
      const { businessAuthorizationService } = await import('@core/authorization/business-authorization.service');
      const { getActiveActor } = await import('@core/actors/actor.helpers');
      
      const actor = await getActiveActor(tenantId, userId);
      if (!actor) {
        return reply.status(403).send({ error: 'Actor não encontrado' });
      }

      // Verificar permissão para payouts
      await businessAuthorizationService.requirePermission(
        tenantId,
        userId,
        actor.actor_id,
        'financial:execute_payout',
        'payout'
      );
    } catch (permError: any) {
      return reply.status(403).send({ error: 'Sem permissão para acessar payouts' });
    }
  };

  /**
   * POST /payouts/batches
   * Cria payout batch e gera orders
   */
  fastify.post<{ Body: CreatePayoutBatchInput }>(
    '/payouts/batches',
    { preHandler: requirePayoutPermission },
    async (req, reply) => {
      const tenantId = req.tenant.id;
      const result = await payoutService.createPayoutBatch(tenantId, req.body);

      return reply.status(201).send(result);
    }
  );

  /**
   * GET /payouts/batches
   * Lista payout batches
   */
  fastify.get<{
    Querystring: {
      status?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    };
  }>('/payouts/batches', { preHandler: requirePayoutPermission }, async (req, reply) => {
    const tenantId = req.tenant.id;
    const filters = {
      status: req.query.status as any,
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const batches = await payoutService.listBatches(tenantId, filters);

    return reply.send({ batches, total: batches.length });
  });

  /**
   * GET /payouts/batches/:batchId
   * Busca payout batch por ID
   */
  fastify.get<{ Params: { batchId: string } }>(
    '/payouts/batches/:batchId',
    { preHandler: requirePayoutPermission },
    async (req, reply) => {
      const tenantId = req.tenant.id;
      const batch = await payoutService.getBatchById(tenantId, req.params.batchId);

      return reply.send({ batch });
    }
  );

  /**
   * GET /payouts/orders
   * Lista payout orders
   */
  fastify.get<{
    Querystring: {
      batchId?: string;
      actorId?: string;
      status?: string;
      payoutMethod?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    };
  }>('/payouts/orders', { preHandler: requirePayoutPermission }, async (req, reply) => {
    const tenantId = req.tenant.id;
    const filters = {
      batchId: req.query.batchId,
      actorId: req.query.actorId,
      status: req.query.status as any,
      payoutMethod: req.query.payoutMethod as any,
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const orders = await payoutService.listOrders(tenantId, filters);

    return reply.send({ orders, total: orders.length });
  });

  /**
   * GET /payouts/orders/:orderId
   * Busca payout order por ID
   */
  fastify.get<{ Params: { orderId: string } }>(
    '/payouts/orders/:orderId',
    { preHandler: requirePayoutPermission },
    async (req, reply) => {
      const tenantId = req.tenant.id;
      const order = await payoutService.getOrderById(tenantId, req.params.orderId);

      return reply.send({ order });
    }
  );

  /**
   * POST /payouts/orders/:orderId/execute-manual
   * Executa payout manual (mock)
   */
  fastify.post<{ Params: { orderId: string }; Body: ExecutePayoutManualInput }>(
    '/payouts/orders/:orderId/execute-manual',
    { preHandler: requirePayoutPermission },
    async (req, reply) => {
      const tenantId = req.tenant.id;
      const userId = req.user?.id || null;

      const order = await payoutService.executePayoutManual(tenantId, req.params.orderId, {
        ...req.body,
        executedByUserId: userId,
      });

      return reply.send({ order });
    }
  );

  /**
   * POST /payouts/orders/:orderId/fail
   * Marca payout como falho
   */
  fastify.post<{ Params: { orderId: string }; Body: FailPayoutInput }>(
    '/payouts/orders/:orderId/fail',
    { preHandler: requirePayoutPermission },
    async (req, reply) => {
      const tenantId = req.tenant.id;
      const userId = req.user?.id || null;

      const order = await payoutService.markAsFailed(tenantId, req.params.orderId, {
        ...req.body,
        failedByUserId: userId,
      });

      return reply.send({ order });
    }
  );
};

export default payoutRoutes;




