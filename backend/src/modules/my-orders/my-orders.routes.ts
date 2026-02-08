// backend/src/modules/my-orders/my-orders.routes.ts
// Rotas para My Orders & Purchases Hub
// 🔴 BLINDAGEM: Apenas read-only, nenhuma mutação

import type { FastifyInstance } from 'fastify';
import { myOrdersService } from './my-orders.service';
import type { MyOrdersFilters } from './my-orders.types';

const myOrdersRoutes = async (fastify: FastifyInstance) => {
  /**
   * GET /my-orders
   * Lista todos os pedidos do comprador (agregado)
   */
  fastify.get<{
    Querystring: {
      orderType?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      hasOpenDispute?: boolean;
      limit?: number;
      offset?: number;
    };
  }>('/my-orders', async (req, reply) => {
    const tenantId = req.tenant.id;
    const userId = req.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    // Buscar actor do usuário
    const { getActiveActor } = await import('@core/actors/actor.helpers');
    const actor = await getActiveActor(tenantId, userId);
    if (!actor) {
      return reply.status(403).send({ error: 'Actor não encontrado' });
    }

    const filters: MyOrdersFilters = {
      orderType: req.query.orderType as any,
      status: req.query.status as any,
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      hasOpenDispute: req.query.hasOpenDispute === true,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const orders = await myOrdersService.listMyOrders(tenantId, actor.actor_id, filters);

    return reply.send({ orders, totalCents: orders.length });
  });

  /**
   * GET /my-orders/stats
   * Estatísticas do My Orders Hub
   */
  fastify.get<{}>('/my-orders/stats', async (req, reply) => {
    const tenantId = req.tenant.id;
    const userId = req.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    // Buscar actor do usuário
    const { getActiveActor } = await import('@core/actors/actor.helpers');
    const actor = await getActiveActor(tenantId, userId);
    if (!actor) {
      return reply.status(403).send({ error: 'Actor não encontrado' });
    }

    const stats = await myOrdersService.getMyOrdersStats(tenantId, actor.actor_id);

    return reply.send({ stats });
  });
};

export default myOrdersRoutes;





