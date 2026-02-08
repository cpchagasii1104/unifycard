// backend/src/modules/dashboard/dashboard.routes.ts
// SPRINT 49: DASHBOARDS OPERACIONAIS - Rotas REST

import type { FastifyInstance } from 'fastify';
import { dashboardService } from './dashboard.service';
import type { DashboardFilters } from './dashboard.types';

/**
 * Helper para resolver actorId do ActionContext
 * ActionContext é obrigatório em todas as rotas (V2)
 */
function resolveActorId(req: any): string {
  // ActionContext é obrigatório (V2)
  if (!req.actionContext || !req.actionContext.actorId) {
    throw new Error('ActionContext obrigatório');
  }
  
  return req.actionContext.actorId;
}

const dashboardRoutes = async (fastify: FastifyInstance) => {
  /**
   * GET /dashboard/overview
   * Visão geral do dashboard (hoje + mês + canais + estoque)
   */
  fastify.get('/overview', {
    preHandler: [fastify.requirePermission(['dashboard:view'])],
  }, async (req, reply) => {
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const tenantId = req.tenant!.id;
    const actorId = req.actionContext.actorId;
    const query = req.query as any;

    const filters: DashboardFilters = {};

    if (query.actorId) {
      filters.actorId = query.actorId;
    }

    if (query.channel) {
      filters.channel = query.channel as 'PDV' | 'MARKETPLACE' | 'ALL';
    }

    // SPRINT 51: Filtros de consolidação
    if (query.organizationUnitId) {
      filters.organizationUnitId = query.organizationUnitId;
    }
    if (query.consolidated === 'true') {
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const { authorizationService } = await import('@core/authorization/authorization.service');
      const auth = await authorizationService.canActAs(
        tenantId,
        req.actionContext.actorId,
        req.actionContext.actorId,
        'view_consolidated_reports'
      );
      if (!auth.allowed) {
        return reply.status(403).send({
          error: 'Permission denied',
          message: 'view_consolidated_reports permission required for consolidated reports',
        });
      }
      filters.consolidated = true;
    }

    const overview = await dashboardService.getOverview(tenantId, actorId, actorId, filters);
    return reply.status(200).send(overview);
  });

  /**
   * GET /dashboard/today
   * Visão do dia
   */
  fastify.get('/today', {
    preHandler: [fastify.requirePermission(['dashboard:view'])],
  }, async (req, reply) => {
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const tenantId = req.tenant!.id;
    const actorId = req.actionContext.actorId;
    const query = req.query as any;

    const filters: DashboardFilters = {};

    if (query.actorId) {
      filters.actorId = query.actorId;
    }

    if (query.channel) {
      filters.channel = query.channel as 'PDV' | 'MARKETPLACE' | 'ALL';
    }

    const today = await dashboardService.getTodayOverview(tenantId, actorId, actorId, filters);
    return reply.status(200).send(today);
  });

  /**
   * GET /dashboard/month
   * Visão do mês
   */
  fastify.get('/month', {
    preHandler: [fastify.requirePermission(['dashboard:view'])],
  }, async (req, reply) => {
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const tenantId = req.tenant!.id;
    const actorId = req.actionContext.actorId;
    const query = req.query as any;

    const filters: DashboardFilters = {};

    if (query.actorId) {
      filters.actorId = query.actorId;
    }

    if (query.channel) {
      filters.channel = query.channel as 'PDV' | 'MARKETPLACE' | 'ALL';
    }

    const month = await dashboardService.getMonthOverview(tenantId, actorId, actorId, filters);
    return reply.status(200).send(month);
  });

  /**
   * GET /dashboard/sales
   * Dashboard de vendas
   */
  fastify.get('/sales', {
    preHandler: [fastify.requirePermission(['dashboard:view'])],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const filters: DashboardFilters = {};

    if (query.startDate) {
      filters.startDate = new Date(query.startDate);
    }

    if (query.endDate) {
      filters.endDate = new Date(query.endDate);
    }

    if (query.actorId) {
      filters.actorId = query.actorId;
    }

    if (query.channel) {
      filters.channel = query.channel as 'PDV' | 'MARKETPLACE' | 'ALL';
    }

    const sales = await dashboardService.getSalesDashboard(tenantId, filters);
    return reply.status(200).send(sales);
  });

  /**
   * GET /dashboard/inventory
   * Dashboard de estoque
   */
  fastify.get('/inventory', {
    preHandler: [fastify.requirePermission(['dashboard:view'])],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const filters: DashboardFilters = {};

    if (query.variantId) {
      filters.actorId = query.variantId; // Reutilizar filtro (não usado em inventory)
    }

    const inventory = await dashboardService.getInventoryDashboard(tenantId, filters);
    return reply.status(200).send(inventory);
  });
};

export default dashboardRoutes;

