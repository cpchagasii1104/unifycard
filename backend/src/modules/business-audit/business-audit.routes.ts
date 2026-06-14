// backend/src/modules/business-audit/business-audit.routes.ts
// Rotas para Auditoria de Negócio
// 🔴 BLINDAGEM: Apenas leitura - logs são imutáveis

import { FastifyPluginAsync } from 'fastify';
import { businessAuditLogService } from './business-audit.service';
import type { BusinessAuditLogFilters } from './business-audit.types';

const businessAuditRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Middleware: Verificar permissão para LER logs de auditoria.
   *
   * 🔴 ESCOPO R2 (F-R2-FINE-GRANTS-ANCHOR-AND-SCOPE-CLOSURE, 2026-06-14, reseal Yala / decisão Clayton):
   * a autoridade fina é `company_users.can_view_audit_logs` (DECISION-0125), COMPANY-SCOPED — grant em uma
   * empresa NÃO autoriza ler logs tenant-wide. SUBJECT = req.user.id (server-side); query.actorId = alvo
   * de leitura (o repositório FILTRA por actor_id), NUNCA subject. A LISTAGEM exige um actor-alvo que
   * resolva para empresa (actors.company_id) e can_view_audit_logs NAQUELA empresa; sem alvo resolvível
   * (listagem tenant-wide) → FAIL-CLOSED (company_scope_required), DECISION_REQUIRED (platform-admin).
   */
  const requireAuditActorScoped = async (req: any, reply: any) => {
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
      // 1) Preferir COMPANY-SCOPED quando o actorId-alvo resolve para uma empresa (company_users.can_view_audit_logs).
      const companyId = await companiesService.resolveCompanyIdForActor(tenantId, req.query?.actorId);
      if (companyId) {
        const { allowed } = await companiesService.canUserPerformCompanyCapability(
          tenantId, userId, 'can_view_audit_logs', { companyId }
        );
        if (!allowed) {
          return reply.status(403).send({ error: 'Sem permissão para visualizar logs de auditoria desta empresa' });
        }
        return;
      }
      // 2) Sem actor/company resolvível (listagem tenant-wide) → grant TENANT-LEVEL (DECISION-0126),
      //    nunca company_users (grant de empresa não abre tenant-wide).
      const { allowed } = await companiesService.canUserPerformTenantCapability(
        tenantId, userId, 'can_view_tenant_audit_logs'
      );
      if (!allowed) {
        return reply.status(403).send({ error: 'Sem grant tenant-level para auditoria (can_view_tenant_audit_logs)', code: 'TENANT_GRANT_REQUIRED' });
      }
    } catch {
      return reply.status(403).send({ error: 'Sem permissão para visualizar logs de auditoria' });
    }
  };

  // Busca por logId não tem actor-alvo resolvível por desenho → grant TENANT-LEVEL (DECISION-0126).
  const requireAuditTenantWide = async (req: any, reply: any) => {
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
        tenantId, userId, 'can_view_tenant_audit_logs'
      );
      if (!allowed) {
        return reply.status(403).send({ error: 'Sem grant tenant-level para auditoria (can_view_tenant_audit_logs)', code: 'TENANT_GRANT_REQUIRED' });
      }
    } catch {
      return reply.status(403).send({ error: 'Sem grant tenant-level para auditoria' });
    }
  };

  /**
   * GET /business-audit-logs
   * Listar logs de auditoria com filtros
   */
  fastify.get<{
    Querystring: {
      actorId?: string;
      action?: string;
      contextType?: string;
      contextId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    };
  }>('/business-audit-logs', {
    preHandler: requireAuditActorScoped,
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;

    try {
      const filters: BusinessAuditLogFilters = {
        actorId: req.query.actorId,
        action: req.query.action as any,
        contextType: req.query.contextType as any,
        contextId: req.query.contextId,
        startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit.toString(), 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset.toString(), 10) : undefined,
      };

      const result = await businessAuditLogService.listLogs(tenantId, filters);
      return result;
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao listar logs de auditoria');
      return reply.status(error.statusCode || 500).send({
        error: 'Erro ao listar logs de auditoria',
        message: error.message,
      });
    }
  });

  /**
   * GET /business-audit-logs/:logId
   * Buscar log por ID
   */
  fastify.get<{ Params: { logId: string } }>(
    '/business-audit-logs/:logId',
    {
      preHandler: requireAuditTenantWide,
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { logId } = req.params;

      try {
        const log = await businessAuditLogService.getLogById(tenantId, logId);
        return log;
      } catch (error: any) {
        fastify.log.error({ err: error }, 'Erro ao buscar log de auditoria');
        return reply.status(error.statusCode || 500).send({
          error: 'Erro ao buscar log de auditoria',
          message: error.message,
        });
      }
    }
  );
};

export default businessAuditRoutes;



