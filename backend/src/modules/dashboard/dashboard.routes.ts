// backend/src/modules/dashboard/dashboard.routes.ts
// SPRINT 49: DASHBOARDS OPERACIONAIS - Rotas REST

import type { FastifyInstance } from 'fastify';
import { dashboardService } from './dashboard.service';
import { authorizationService } from '@core/authorization/authorization.service';
import type { DashboardFilters } from './dashboard.types';

/**
 * 🔴 DECISION-0113 — resolve o actorId AUTORIZADO de um relatório dashboard/reports.
 * `dashboard:view`/`reports:view_operational` provam acesso ao MÓDULO (ownership do PRÓPRIO actor), NÃO
 * autoridade sobre o actor filtrado. `query.actorId` é HINT → exigir canRepresentActor; sem query.actorId →
 * self via actionContext (validado). Sem tenant-wide silencioso. Envia 401/403/400 e retorna null se negado.
 */
async function resolveReportActorId(req: any, reply: any): Promise<string | null> {
  const userId = req?.user?.userId as string | undefined;
  if (!userId) { reply.status(401).send({ ok: false, error: 'Autenticação obrigatória (req.user.userId)' }); return null; }
  if (!req.actionContext?.actorId) { reply.status(400).send({ ok: false, error: 'ActionContext obrigatório' }); return null; }
  const target = req.query?.actorId ? String(req.query.actorId) : String(req.actionContext.actorId);
  let canRep = false;
  try { canRep = await authorizationService.canRepresentActor(req.tenant.id, userId, target); } catch { canRep = false; }
  if (!canRep) { reply.status(403).send({ ok: false, error: 'Sem autoridade sobre o actor do relatório (canRepresentActor)', code: 'REPORT_ACTOR_NOT_REPRESENTABLE' }); return null; }
  return target;
}

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
   * Ordem de autorização (N3): 1) preHandler `fastify.requirePermission` = RBAC V2 (actor+intent+scope);
   * 2) onde aplicável, `authorityService.canPerformAction` = PermissionKey + quarentena + canActAs (userId humano).
   */
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

    // 🔴 DECISION-0113 / Z2-R2: query.actorId é HINT de filtro, NÃO authority. `dashboard:view` prova
    // acesso ao MÓDULO, não autoridade sobre o actor filtrado. Só aplica se o usuário AUTENTICADO
    // REPRESENTA o actor alvo (canRepresentActor via resolveReportActorId) — 403 senão. Mesmo padrão de /sales.
    if (query.actorId) {
      const authorizedActorId = await resolveReportActorId(req, reply);
      if (authorizedActorId === null) return; // 401/403/400 já enviado
      filters.actorId = authorizedActorId;
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
      if (!req.user?.id) {
        return reply.status(401).send({ error: 'Autenticação obrigatória para relatório consolidado' });
      }

      const { authorityService } = await import('@modules/authority/authority.service');
      const auth = await authorityService.canPerformAction(
        req.actionContext.actorId,
        'view_consolidated_reports',
        undefined,
        {
          tenantId,
          userId: req.user.id,
        }
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

    // 🔴 DECISION-0113 / Z2-R2: query.actorId é HINT de filtro, NÃO authority. `dashboard:view` prova
    // acesso ao MÓDULO, não autoridade sobre o actor filtrado. Só aplica se o usuário AUTENTICADO
    // REPRESENTA o actor alvo (canRepresentActor via resolveReportActorId) — 403 senão. Mesmo padrão de /sales.
    if (query.actorId) {
      const authorizedActorId = await resolveReportActorId(req, reply);
      if (authorizedActorId === null) return; // 401/403/400 já enviado
      filters.actorId = authorizedActorId;
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

    // 🔴 DECISION-0113 / Z2-R2: query.actorId é HINT de filtro, NÃO authority. `dashboard:view` prova
    // acesso ao MÓDULO, não autoridade sobre o actor filtrado. Só aplica se o usuário AUTENTICADO
    // REPRESENTA o actor alvo (canRepresentActor via resolveReportActorId) — 403 senão. Mesmo padrão de /sales.
    if (query.actorId) {
      const authorizedActorId = await resolveReportActorId(req, reply);
      if (authorizedActorId === null) return; // 401/403/400 já enviado
      filters.actorId = authorizedActorId;
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

    // 🔴 DECISION-0113: query.actorId é HINT → representável OU self via actionContext. Nunca cru/tenant-wide.
    const authorizedActorId = await resolveReportActorId(req, reply);
    if (authorizedActorId === null) return; // 401/403/400 já enviado
    filters.actorId = authorizedActorId;

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

