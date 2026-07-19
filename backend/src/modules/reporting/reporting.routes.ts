// backend/src/modules/reporting/reporting.routes.ts
// Rotas para Reporting Institucional
// 🔴 BLINDAGEM: RBAC obrigatório (apenas FINANCE/OWNER/ADMIN)

import type { FastifyInstance } from 'fastify';
import { reportingService } from './reporting.service';
import type { ReportingFilters, ExportInput } from './reporting.types';

const reportingRoutes = async (fastify: FastifyInstance) => {
  /**
   * Middleware: Verificar permissão para acessar reporting (TENANT-WIDE).
   *
   * 🔵 R2 TENANT-LEVEL (F-R2-TENANT-LEVEL-OPERATOR-GRANTS, 2026-06-14, DECISION-0126): reporting agrega
   * dados TENANT-WIDE (reportingService.getFinancialKPIs(tenantId, ...)). A autoridade vem do modelo
   * MATERIAL SEPARADO `tenant_operator_grants.can_view_tenant_reports` — NÃO de `company_users.can_*`
   * (grant de empresa NUNCA autoriza tenant-wide, DECISION-0125 §escopo). SUBJECT = req.user.id
   * (server-side; identidade global resolvida via JOIN canônico users.global_user_id); nada client-declared
   * autoriza. Grant em tenant A não vale tenant B. Sem grant tenant-level → 403.
   */
  const requireReportingPermission = async (req: any, reply: any) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const userId = req.user?.id;
    if (!userId) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }
    try {
      const { companiesService } = await import('@core/companies/companies.service');
      const { allowed } = await companiesService.canUserPerformTenantCapability(
        tenantId,
        userId,
        'can_view_tenant_reports'
      );
      if (!allowed) {
        return reply.status(403).send({ error: 'Sem grant tenant-level para reporting (can_view_tenant_reports)', code: 'TENANT_GRANT_REQUIRED' });
      }
    } catch {
      return reply.status(403).send({ error: 'Sem grant tenant-level para reporting' });
    }
  };

  /**
   * GET /reporting/financial-kpis
   * Calcula KPIs Financeiros Principais
   */
  fastify.get<{
    Querystring: {
      startDate?: string;
      endDate?: string;
      currency?: string;
    };
  }>('/reporting/financial-kpis', { preHandler: requireReportingPermission }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;

    // 🔒 DECISION-0189C D5: KPIs projetam payouts/invoices — 503 para a superfície inteira
    // enquanto a PORTA 01 estiver fechada (tenant-operator NÃO supera o HOLD).
    const { isPorta01Closed, FINANCIAL_PROJECTION_HELD_BODY } = await import('@core/authorization/financial-projection-hold');
    if (isPorta01Closed()) {
      reply.header('Cache-Control', 'no-store');
      return reply.status(503).send(FINANCIAL_PROJECTION_HELD_BODY);
    }

    // `actorId` REMOVIDO (F-R2-FINE-GRANTS-ANCHOR-AND-SCOPE-CLOSURE): o service NÃO honra filtro por actor
    // (agrega tenant-wide); o filtro era morto e mascarava a natureza tenant-wide. A rota é fail-closed no
    // preHandler até existir grant platform-admin (DECISION_REQUIRED).
    const filters: ReportingFilters = {
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      currency: req.query.currency,
    };

    const kpis = await reportingService.getFinancialKPIs(tenantId, filters);

    return reply.send({ kpis });
  });

  /**
   * GET /reporting/revenue-by-period
   * Receita por Período
   */
  fastify.get<{
    Querystring: {
      startDate?: string;
      endDate?: string;
      currency?: string;
    };
  }>('/reporting/revenue-by-period', { preHandler: requireReportingPermission }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const filters: ReportingFilters = {
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      currency: req.query.currency,
    };

    const revenue = await reportingService.getRevenueByPeriod(tenantId, filters);

    return reply.send({ revenue });
  });

  /**
   * GET /reporting/revenue-by-service-type
   * Receita por Tipo de Serviço
   */
  fastify.get<{
    Querystring: {
      startDate?: string;
      endDate?: string;
      currency?: string;
    };
  }>('/reporting/revenue-by-service-type', { preHandler: requireReportingPermission }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const filters: ReportingFilters = {
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      currency: req.query.currency,
    };

    const revenue = await reportingService.getRevenueByServiceType(tenantId, filters);

    return reply.send({ revenue });
  });

  /**
   * GET /reporting/platform-commission
   * Comissão da Plataforma por Período
   */
  fastify.get<{
    Querystring: {
      startDate?: string;
      endDate?: string;
      currency?: string;
    };
  }>('/reporting/platform-commission', { preHandler: requireReportingPermission }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const filters: ReportingFilters = {
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      currency: req.query.currency,
    };

    const commission = await reportingService.getPlatformCommission(tenantId, filters);

    return reply.send({ commission });
  });

  /**
   * GET /reporting/trust-overview
   * Trust & Risk Overview
   */
  fastify.get<{
    Querystring: {
      status?: string; // Risk level filter
      limit?: number;
      offset?: number;
    };
  }>('/reporting/trust-overview', { preHandler: requireReportingPermission }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const filters: ReportingFilters = {
      status: req.query.status,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const overview = await reportingService.getTrustOverview(tenantId, filters);

    return reply.send({ overview, totalCents: overview.length });
  });

  /**
   * GET /reporting/dispute-overview
   * Dispute Overview
   */
  fastify.get<{
    Querystring: {
      status?: string; // Dispute status filter
      limit?: number;
      offset?: number;
    };
  }>('/reporting/dispute-overview', { preHandler: requireReportingPermission }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const filters: ReportingFilters = {
      status: req.query.status,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const overview = await reportingService.getDisputeOverview(tenantId, filters);

    return reply.send({ overview, totalCents: overview.length });
  });

  /**
   * POST /reporting/export
   * Exporta dados em CSV ou JSON
   */
  fastify.post<{ Body: ExportInput }>(
    '/reporting/export',
    { preHandler: requireReportingPermission },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const filters: ReportingFilters = {
        startDate: req.body.filters?.startDate ? new Date(req.body.filters.startDate) : undefined,
        endDate: req.body.filters?.endDate ? new Date(req.body.filters.endDate) : undefined,
        status: req.body.filters?.status,
        currency: req.body.filters?.currency,
      };

      // 🔒 DECISION-0189C D5: exports financeiros (repasses/faturas) → 503 sob PORTA 01
      // (exports não-financeiros como trust seguem normalmente).
      {
        const { isPorta01Closed, FINANCIAL_PROJECTION_HELD_BODY } = await import('@core/authorization/financial-projection-hold');
        if (isPorta01Closed() && (req.body.exportType === 'payouts' || req.body.exportType === 'invoices')) {
          reply.header('Cache-Control', 'no-store');
          return reply.status(503).send(FINANCIAL_PROJECTION_HELD_BODY);
        }
      }

      const exportData = await reportingService.exportData(
        tenantId,
        req.body.exportType,
        req.body.format,
        filters
      );

      // Retornar como download
      reply.header('Content-Type', exportData.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${exportData.filename}"`);

      return reply.send(exportData.data);
    }
  );
};

export default reportingRoutes;





