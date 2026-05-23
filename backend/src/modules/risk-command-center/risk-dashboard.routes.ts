// backend/src/modules/risk-command-center/risk-dashboard.routes.ts
// Rotas para Risk & Trust Command Center
// 🔴 BLINDAGEM: RBAC obrigatório (apenas OWNER/ADMIN/FINANCE)

import type { FastifyInstance } from 'fastify';
import { riskDashboardService } from './risk-dashboard.service';
import type { ActorRiskFilters } from './risk-dashboard.types';

const riskDashboardRoutes = async (fastify: FastifyInstance) => {
  /**
   * Middleware: Verificar permissão para acessar Risk Command Center
   */
  const requireRiskPermission = async (req: any, reply: any) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    const actorId = req.actionContext.actorId;

    try {
      const { businessAuthorizationService } = await import('@core/authorization/business-authorization.service');

      // Verificar permissão para acessar risk dashboard
      await businessAuthorizationService.requirePermission(
        tenantId,
        actorId,
        actorId,
        'financial:view_all_ledger', // Reutilizar permissão de finance
        'risk_command_center'
      );
    } catch (permError: any) {
      return reply.status(403).send({ error: 'Sem permissão para acessar Risk Command Center' });
    }
  };

  /**
   * Registrar auditoria de acesso
   */
  const recordAccessAudit = async (tenantId: string, actorId: string, action: string) => {
    try {
      const { recordBusinessAuditSafely } = await import('../business-audit/business-audit.helpers');
      await recordBusinessAuditSafely(tenantId, {
        action: 'risk_dashboard_viewed' as any,
        actorId,
        contextType: 'risk_command_center' as any,
        contextId: action,
        metadata: {
          action,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      // Não bloquear se auditoria falhar
      console.warn('[Risk Dashboard] Erro ao registrar auditoria:', err);
    }
  };

  /**
   * GET /risk/dashboard/overview
   * Overview do Risk Dashboard
   */
  fastify.get<{}>(
    '/risk/dashboard/overview',
    { preHandler: requireRiskPermission },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      const actorId = req.actionContext.actorId;

      // Registrar auditoria
      await recordAccessAudit(tenantId, actorId, 'overview');

      const overview = await riskDashboardService.getOverview(tenantId);

      return reply.send({ overview });
    }
  );

  /**
   * GET /risk/dashboard/actors
   * Lista Actor Risk Profiles com filtros
   */
  fastify.get<{
    Querystring: {
      riskLevel?: string;
      minTrustScore?: number;
      maxTrustScore?: number;
      hasOpenDisputes?: boolean;
      hasBypassDetected?: boolean;
      minFinancialVolumeCents?: number;
      limit?: number;
      offset?: number;
    };
  }>('/risk/dashboard/actors', { preHandler: requireRiskPermission }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      const actorId = req.actionContext.actorId;

      // Registrar auditoria
      await recordAccessAudit(tenantId, actorId, 'list_actors');

    const filters: ActorRiskFilters = {
      riskLevel: req.query.riskLevel as any,
      minTrustScore: req.query.minTrustScore,
      maxTrustScore: req.query.maxTrustScore,
      hasOpenDisputes: req.query.hasOpenDisputes === true,
      hasBypassDetected: req.query.hasBypassDetected === true,
      minFinancialVolumeCents: req.query.minFinancialVolumeCents,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const profiles = await riskDashboardService.listActorRiskProfiles(tenantId, filters);

    return reply.send({ profiles, totalCents: profiles.length });
  });

  /**
   * GET /risk/dashboard/actors/:actorId
   * Busca Risk Profile detalhado de um actor
   */
  fastify.get<{ Params: { actorId: string } }>(
    '/risk/dashboard/actors/:actorId',
    { preHandler: requireRiskPermission },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      const actorId = req.actionContext.actorId;

      // Registrar auditoria
      await recordAccessAudit(tenantId, actorId, `view_actor:${req.params.actorId}`);

      const profile = await riskDashboardService.getActorRiskProfile(tenantId, req.params.actorId);

      return reply.send({ profile });
    }
  );

  /**
   * GET /risk/dashboard/actors/:actorId/timeline
   * Timeline consolidada de eventos de risco para um actor
   */
  fastify.get<{ Params: { actorId: string } }>(
    '/risk/dashboard/actors/:actorId/timeline',
    { preHandler: requireRiskPermission },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }
      const actorId = req.actionContext.actorId;

      // Registrar auditoria
      await recordAccessAudit(tenantId, actorId, `view_timeline:${req.params.actorId}`);

      const timeline = await riskDashboardService.getActorRiskTimeline(tenantId, req.params.actorId);

      return reply.send({ timeline });
    }
  );
};

export default riskDashboardRoutes;





