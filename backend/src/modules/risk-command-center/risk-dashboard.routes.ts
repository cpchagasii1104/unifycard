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
    // 🔵 R2 (F-R2-COMPANY-USERS-FINE-GRANTS-MATERIALIZATION, 2026-06-13) + DECISION-0113: o SUBJECT da
    // autorização vem do utilizador AUTENTICADO server-side (req.user.userId/JWT), NUNCA do
    // actionContext.actorId (client-declared). A autoridade fina é `company_users.can_view_risk` (fonte
    // material do R2 mínimo), NÃO o chain legado businessAuthorizationService→organization_members (ausente
    // ⇒ 403 sempre). O authorizer resolve a identidade global via JOIN canônico users.global_user_id.
    // actionContext.actorId permanece HINT/alvo/contexto (usado só para auditoria nos handlers), NUNCA subject.
    // can_manage_risk fica RESERVADO para futuras ações de mitigação (sem runtime hoje).
    const userId = req.user?.userId ?? req.user?.id;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    try {
      const { companiesService } = await import('@core/companies/companies.service');
      const { allowed } = await companiesService.canUserPerformCompanyCapability(
        tenantId,
        userId,
        'can_view_risk'
      );
      if (!allowed) {
        return reply.status(403).send({ error: 'Sem permissão para acessar Risk Command Center' });
      }
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





