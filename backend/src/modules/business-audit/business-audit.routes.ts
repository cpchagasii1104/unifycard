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
   * 🔵 R2 (F-R2-COMPANY-USERS-FINE-GRANTS-MATERIALIZATION, 2026-06-13): a autoridade fina vem de
   * `company_users.can_view_audit_logs` (fonte material do R2 mínimo), NÃO do fastify.requirePermission
   * (['admin:view_audit_logs']) legado (rbac.plugin V2 dormente / grant não semeado ⇒ 403). SUBJECT =
   * req.user.id (server-side); o authorizer resolve a identidade global via JOIN canônico
   * users.global_user_id. Os logs são imutáveis (leitura); query.actorId é FILTRO, NUNCA subject.
   */
  const requireAuditReadPermission = async (req: any, reply: any) => {
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
      const { allowed } = await companiesService.canUserPerformCompanyCapability(
        tenantId,
        userId,
        'can_view_audit_logs'
      );
      if (!allowed) {
        return reply.status(403).send({ error: 'Sem permissão para visualizar logs de auditoria' });
      }
    } catch {
      return reply.status(403).send({ error: 'Sem permissão para visualizar logs de auditoria' });
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
    preHandler: requireAuditReadPermission,
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
      preHandler: requireAuditReadPermission,
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



