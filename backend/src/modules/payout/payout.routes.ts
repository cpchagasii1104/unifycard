// backend/src/modules/payout/payout.routes.ts
// Rotas para Payout Engine
// 🔴 BLINDAGEM: RBAC obrigatório (apenas FINANCE/OWNER/ADMIN)

import type { FastifyInstance } from 'fastify';
import { payoutService } from './payout.service';
import type { CreatePayoutBatchInput, ExecutePayoutManualInput, FailPayoutInput } from './payout.types';
import { BadRequestError, ForbiddenError, UnauthorizedError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

const payoutRoutes = async (fastify: FastifyInstance) => {
  const requirePayoutPermission = async (req: any, _reply: any) => {
    if (!req.tenant) {
      throw new BadRequestError('Tenant required', ErrorCode.MISSING_TENANT);
    }
    const tenantId = req.tenant.id;
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedError('Not authenticated');
    }

    try {
      const { businessAuthorizationService } = await import(
        '@core/authorization/business-authorization.service'
      );
      const { getActiveActor } = await import('@core/actors/actor.helpers');

      const actor = await getActiveActor(tenantId, userId);
      if (!actor) {
        throw new ForbiddenError('Actor not found', ErrorCode.MISSING_ACTOR);
      }

      await businessAuthorizationService.requirePermission(
        tenantId,
        userId,
        actor.actor_id,
        'financial:execute_payout',
        'payout'
      );
    } catch (e) {
      if (e instanceof ForbiddenError || e instanceof UnauthorizedError) throw e;
      throw new ForbiddenError('No permission to access payouts', ErrorCode.PERMISSION_DENIED);
    }
  };

  fastify.post<{ Body: CreatePayoutBatchInput }>(
    '/payouts/batches',
    { preHandler: requirePayoutPermission },
    async (req, reply) => {
      if (!req.tenant) {
        throw new BadRequestError('Tenant required', ErrorCode.MISSING_TENANT);
      }
      const tenantId = req.tenant.id;
      const result = await payoutService.createPayoutBatch(tenantId, req.body);

      return reply.status(201).send(result);
    }
  );

  fastify.get<{
    Querystring: {
      status?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    };
  }>('/payouts/batches', { preHandler: requirePayoutPermission }, async (req, reply) => {
    if (!req.tenant) {
      throw new BadRequestError('Tenant required', ErrorCode.MISSING_TENANT);
    }
    const tenantId = req.tenant.id;
    const filters = {
      status: req.query.status as any,
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const batches = await payoutService.listBatches(tenantId, filters);

    return reply.send({ batches, totalCents: batches.length });
  });

  fastify.get<{ Params: { batchId: string } }>(
    '/payouts/batches/:batchId',
    { preHandler: requirePayoutPermission },
    async (req, reply) => {
      if (!req.tenant) {
        throw new BadRequestError('Tenant required', ErrorCode.MISSING_TENANT);
      }
      const tenantId = req.tenant.id;
      const batch = await payoutService.getBatchById(tenantId, req.params.batchId);

      return reply.send({ batch });
    }
  );

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
    if (!req.tenant) {
      throw new BadRequestError('Tenant required', ErrorCode.MISSING_TENANT);
    }
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

    return reply.send({ orders, totalCents: orders.length });
  });

  fastify.get<{ Params: { orderId: string } }>(
    '/payouts/orders/:orderId',
    { preHandler: requirePayoutPermission },
    async (req, reply) => {
      if (!req.tenant) {
        throw new BadRequestError('Tenant required', ErrorCode.MISSING_TENANT);
      }
      const tenantId = req.tenant.id;
      const order = await payoutService.getOrderById(tenantId, req.params.orderId);

      return reply.send({ order });
    }
  );

  fastify.post<{ Params: { orderId: string }; Body: ExecutePayoutManualInput }>(
    '/payouts/orders/:orderId/execute-manual',
    { preHandler: requirePayoutPermission },
    async (req, reply) => {
      if (!req.tenant) {
        throw new BadRequestError('Tenant required', ErrorCode.MISSING_TENANT);
      }
      const tenantId = req.tenant.id;
      const userId = req.user?.id || null;

      const order = await payoutService.executePayoutManual(tenantId, req.params.orderId, {
        ...req.body,
        executedByUserId: userId,
      });

      return reply.send({ order });
    }
  );

  fastify.post<{ Params: { orderId: string }; Body: FailPayoutInput }>(
    '/payouts/orders/:orderId/fail',
    { preHandler: requirePayoutPermission },
    async (req, reply) => {
      if (!req.tenant) {
        throw new BadRequestError('Tenant required', ErrorCode.MISSING_TENANT);
      }
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
