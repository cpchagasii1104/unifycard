// backend/src/modules/reporting/reporting.routes.ts
// Rotas para Reporting Institucional
// 🔴 BLINDAGEM: RBAC obrigatório (apenas FINANCE/OWNER/ADMIN)

import type { FastifyInstance } from 'fastify';
import { reportingService } from './reporting.service';
import type { ReportingFilters, ExportInput } from './reporting.types';

const reportingRoutes = async (fastify: FastifyInstance) => {
  /**
   * Middleware: Verificar permissão para acessar reporting
   */
  const requireReportingPermission = async (req: any, reply: any) => {
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

      // Verificar permissão para reporting
      await businessAuthorizationService.requirePermission(
        tenantId,
        userId,
        actor.actor_id,
        'financial:view_all_ledger',
        'reporting'
      );
    } catch (permError: any) {
      return reply.status(403).send({ error: 'Sem permissão para acessar reporting' });
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
      actorId?: string;
      currency?: string;
    };
  }>('/reporting/financial-kpis', { preHandler: requireReportingPermission }, async (req, reply) => {
    const tenantId = req.tenant.id;
    const filters: ReportingFilters = {
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      actorId: req.query.actorId,
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
      const tenantId = req.tenant.id;
      const filters: ReportingFilters = {
        startDate: req.body.filters?.startDate ? new Date(req.body.filters.startDate) : undefined,
        endDate: req.body.filters?.endDate ? new Date(req.body.filters.endDate) : undefined,
        actorId: req.body.filters?.actorId,
        status: req.body.filters?.status,
        currency: req.body.filters?.currency,
      };

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





