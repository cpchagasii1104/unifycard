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
    const tenantId = req.tenant!.id;
    const userId = req.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    // Buscar actor do usuário
    const { resolveActiveActorFromRequest } = await import('@modules/social/actor.utils');
    const actor = await resolveActiveActorFromRequest(req, tenantId, { allowUserFallback: true, userId });
    if (!actor) {
      return reply.status(403).send({ error: 'Actor não encontrado' });
    }

    // ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
    // ║ STATUS:  CANÔNICO
    // ║ NORMA:   F-DISPUTE-SIGNAL, 2026-07-31 — achado ao provar a fatia (não pedido no pacote,
    // ║          mas bloqueava o próprio fix funcionar ponta-a-ponta)
    // ║ NÃO:     `req.query.hasOpenDispute === true` — querystring HTTP é sempre STRING (ou
    // ║          undefined) em runtime; comparar contra o boolean literal `true` é SEMPRE false,
    // ║          nunca undefined, mesmo sem o param na URL. Antes desta fatia isso era invisível
    // ║          (hasOpenDispute nunca variava — sempre false por outro motivo). Com o sinal de
    // ║          disputa vivo, esse bug passa a FILTRAR toda ordem disputada por padrão, em
    // ║          TODA chamada, mesmo sem pedir o filtro — o oposto do que a fatia existe pra
    // ║          consertar.
    // ║ EM VEZ:  undefined quando ausente (não filtra); 'true'/'false' (string) coeridos
    // ║          explicitamente quando presente.
    // ╚════════════════════════════════════════════════════════════════
    const filters: MyOrdersFilters = {
      orderType: req.query.orderType as MyOrdersFilters['orderType'],
      status: req.query.status as MyOrdersFilters['status'],
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      hasOpenDispute: req.query.hasOpenDispute === undefined ? undefined : String(req.query.hasOpenDispute) === 'true',
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
    const tenantId = req.tenant!.id;
    const userId = req.user?.id;

    if (!userId) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    // Buscar actor do usuário
    const { resolveActiveActorFromRequest } = await import('@modules/social/actor.utils');
    const actor = await resolveActiveActorFromRequest(req, tenantId, { allowUserFallback: true, userId });
    if (!actor) {
      return reply.status(403).send({ error: 'Actor não encontrado' });
    }

    const stats = await myOrdersService.getMyOrdersStats(tenantId, actor.actor_id);

    return reply.send({ stats });
  });
};

export default myOrdersRoutes;





