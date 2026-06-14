// backend/src/modules/reporting/reporting.routes.ts
// Rotas para Reporting Institucional
// 🔴 BLINDAGEM: RBAC obrigatório (apenas FINANCE/OWNER/ADMIN)

import type { FastifyInstance } from 'fastify';
import { reportingService } from './reporting.service';
import type { ReportingFilters, ExportInput } from './reporting.types';

const reportingRoutes = async (fastify: FastifyInstance) => {
  /**
   * Middleware: Verificar permissão para acessar reporting.
   *
   * 🔴 ESCOPO R2 (F-R2-FINE-GRANTS-ANCHOR-AND-SCOPE-CLOSURE, 2026-06-14, reseal Yala / decisão Clayton):
   * a autoridade fina é `company_users.can_view_reports` (DECISION-0125), mas o grant é **company-scoped**
   * — NÃO autoriza leitura tenant-wide. TODAS as rotas de reporting agregam dados TENANT-WIDE
   * (reportingService.getFinancialKPIs(tenantId, ...) etc.; o filtro `actorId` NÃO é honrado pelo service)
   * e NÃO têm empresa-alvo resolvível. Logo, sem modelo de grant platform-admin/tenant-level, o reporting
   * permanece **FAIL-CLOSED** (`company_scope_required`) — DECISION_REQUIRED. Scopear a auth a uma empresa
   * e devolver agregado tenant-wide seria exatamente o vazamento vetado ("grant em uma empresa lê o tenant
   * inteiro"). req.user obrigatório (401); SUBJECT é sempre server-side; nada client-declared autoriza.
   */
  const requireReportingPermission = async (req: any, reply: any) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const userId = req.user?.id;
    if (!userId) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }
    // Tenant-wide agregado, sem empresa-alvo resolvível → fail-closed (platform-admin = DECISION_REQUIRED).
    return reply.status(403).send({
      error: 'Reporting tenant-wide exige grant platform-admin (DECISION_REQUIRED). Grant de empresa não autoriza leitura tenant-wide.',
      code: 'COMPANY_SCOPE_REQUIRED',
    });
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





