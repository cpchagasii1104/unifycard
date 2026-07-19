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
  // 🔴 ESCOPO R2 (F-R2-FINE-GRANTS-ANCHOR-AND-SCOPE-CLOSURE, 2026-06-14, reseal Yala / decisão Clayton):
  // a autoridade fina é `company_users.can_view_risk` (DECISION-0125), COMPANY-SCOPED — grant em uma
  // empresa NÃO autoriza leitura tenant-wide. SUBJECT = req.user (server-side); actionContext/params.actorId
  // = alvo, NUNCA subject. can_manage_risk fica RESERVADO (sem runtime hoje).

  // Rotas TENANT-WIDE (overview, lista de actors): dados agregados do tenant. Autoridade = modelo SEPARADO
  // `tenant_operator_grants.can_view_tenant_risk` (DECISION-0126) — NÃO company_users (grant de empresa não
  // abre tenant-wide). SUBJECT = req.user (server-side). Grant em tenant A não vale tenant B. Sem grant → 403.
  const requireRiskTenantWide = async (req: any, reply: any) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const userId = req.user?.userId ?? req.user?.id;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    try {
      const { companiesService } = await import('@core/companies/companies.service');
      const { allowed } = await companiesService.canUserPerformTenantCapability(
        tenantId,
        userId,
        'can_view_tenant_risk'
      );
      if (!allowed) {
        return reply.status(403).send({ error: 'Sem grant tenant-level para risk (can_view_tenant_risk)', code: 'TENANT_GRANT_REQUIRED' });
      }
    } catch {
      return reply.status(403).send({ error: 'Sem grant tenant-level para risk' });
    }
  };

  // Rotas ACTOR-SCOPED (/actors/:actorId, /actors/:actorId/timeline): o dado é do actor-alvo. Resolve a
  // empresa material do actor (actors.company_id, server-side) e exige can_view_risk NAQUELA empresa.
  // actor-alvo sem company resolvível (ex.: user-actor sem company_id) → fail-closed company_scope_required.
  const requireRiskActorScoped = async (req: any, reply: any) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const userId = req.user?.userId ?? req.user?.id;
    if (!userId) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    try {
      const { companiesService } = await import('@core/companies/companies.service');
      const companyId = await companiesService.resolveCompanyIdForActor(tenantId, req.params?.actorId);
      if (!companyId) {
        return reply.status(403).send({ error: 'Actor-alvo sem empresa resolvível — escopo company obrigatório', code: 'COMPANY_SCOPE_REQUIRED' });
      }
      const { allowed } = await companiesService.canUserPerformCompanyCapability(
        tenantId,
        userId,
        'can_view_risk',
        { companyId }
      );
      if (!allowed) {
        return reply.status(403).send({ error: 'Sem permissão para acessar Risk Command Center desta empresa' });
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
    { preHandler: requireRiskTenantWide },
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

      // 🔒 DECISION-0189C D5: overview projeta payouts — 503 superfície inteira sob PORTA 01.
      const { isPorta01Closed, FINANCIAL_PROJECTION_HELD_BODY } = await import('@core/authorization/financial-projection-hold');
      if (isPorta01Closed()) { reply.header('Cache-Control','no-store'); return reply.status(503).send(FINANCIAL_PROJECTION_HELD_BODY); }
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
  }>('/risk/dashboard/actors', { preHandler: requireRiskTenantWide }, async (req, reply) => {
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

    const { isPorta01Closed, FINANCIAL_PROJECTION_HELD_BODY } = await import('@core/authorization/financial-projection-hold');
    if (isPorta01Closed()) { reply.header('Cache-Control','no-store'); return reply.status(503).send(FINANCIAL_PROJECTION_HELD_BODY); }
    const profiles = await riskDashboardService.listActorRiskProfiles(tenantId, filters);

    return reply.send({ profiles, totalCents: profiles.length });
  });

  /**
   * GET /risk/dashboard/actors/:actorId
   * Busca Risk Profile detalhado de um actor
   */
  fastify.get<{ Params: { actorId: string } }>(
    '/risk/dashboard/actors/:actorId',
    { preHandler: requireRiskActorScoped },
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

      const { isPorta01Closed, FINANCIAL_PROJECTION_HELD_BODY } = await import('@core/authorization/financial-projection-hold');
      if (isPorta01Closed()) { reply.header('Cache-Control','no-store'); return reply.status(503).send(FINANCIAL_PROJECTION_HELD_BODY); }
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
    { preHandler: requireRiskActorScoped },
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

      const { isPorta01Closed, FINANCIAL_PROJECTION_HELD_BODY } = await import('@core/authorization/financial-projection-hold');
      if (isPorta01Closed()) { reply.header('Cache-Control','no-store'); return reply.status(503).send(FINANCIAL_PROJECTION_HELD_BODY); }
      const timeline = await riskDashboardService.getActorRiskTimeline(tenantId, req.params.actorId);

      return reply.send({ timeline });
    }
  );
};

export default riskDashboardRoutes;





