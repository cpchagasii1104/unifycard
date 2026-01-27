// backend/src/modules/business-audit/business-audit.routes.ts
// Rotas para Auditoria de Negócio
// 🔴 BLINDAGEM: Apenas leitura - logs são imutáveis

import { FastifyPluginAsync } from 'fastify';
import { businessAuditLogService } from './business-audit.service';
import type { BusinessAuditLogFilters } from './business-audit.types';

const businessAuditRoutes: FastifyPluginAsync = async (fastify) => {
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
    preHandler: [fastify.requirePermission(['admin:view_audit_logs'])],
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
      preHandler: [fastify.requirePermission(['admin:view_audit_logs'])],
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



