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

      // Verificar permissão para acessar risk dashboard
      await businessAuthorizationService.requirePermission(
        tenantId,
        userId,
        actor.actor_id,
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
  const recordAccessAudit = async (tenantId: string, userId: string | null, actorId: string, action: string) => {
    try {
      const { recordBusinessAuditSafely } = await import('../business-audit/business-audit.helpers');
      await recordBusinessAuditSafely(tenantId, {
        action: 'risk_dashboard_viewed' as any,
        actorId,
        userId,
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
      const tenantId = req.tenant.id;
      const userId = req.user?.id || null;
      const actorId = req.user?.actorId || '';

      // Registrar auditoria
      await recordAccessAudit(tenantId, userId, actorId, 'overview');

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
    const tenantId = req.tenant.id;
    const userId = req.user?.id || null;
    const actorId = req.user?.actorId || '';

    // Registrar auditoria
    await recordAccessAudit(tenantId, userId, actorId, 'list_actors');

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

    return reply.send({ profiles, total: profiles.length });
  });

  /**
   * GET /risk/dashboard/actors/:actorId
   * Busca Risk Profile detalhado de um actor
   */
  fastify.get<{ Params: { actorId: string } }>(
    '/risk/dashboard/actors/:actorId',
    { preHandler: requireRiskPermission },
    async (req, reply) => {
      const tenantId = req.tenant.id;
      const userId = req.user?.id || null;
      const actorId = req.user?.actorId || '';

      // Registrar auditoria
      await recordAccessAudit(tenantId, userId, actorId, `view_actor:${req.params.actorId}`);

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
      const tenantId = req.tenant.id;
      const userId = req.user?.id || null;
      const actorId = req.user?.actorId || '';

      // Registrar auditoria
      await recordAccessAudit(tenantId, userId, actorId, `view_timeline:${req.params.actorId}`);

      const timeline = await riskDashboardService.getActorRiskTimeline(tenantId, req.params.actorId);

      return reply.send({ timeline });
    }
  );
};

export default riskDashboardRoutes;




