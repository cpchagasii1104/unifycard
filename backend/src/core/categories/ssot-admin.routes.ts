// backend/src/core/categories/ssot-admin.routes.ts
// Rotas administrativas para métricas SSOT
// Apenas role 'admin' pode acessar

import { FastifyPluginAsync } from 'fastify';
import { ssotObservabilityUtil } from '@core/observability/ssot-observability.util';

const ssotAdminRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /admin/ssot/metrics
   * Retorna métricas de violações SSOT
   * Apenas ADMIN pode acessar
   */
  fastify.get<{
    Querystring: {
      tenantId?: string;
      startDate?: string;
      endDate?: string;
    };
  }>('/metrics', {
    preHandler: async (req, reply) => {
      await (fastify as any).requireRole(['admin'])(req, reply);
    },
  }, async (req, reply) => {
    if (!req.user || !req.tenant) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    try {
      // 🔴 F-BUCKET-A / DT-INTERNAL-SSOT-ADMIN-TENANT-QUERY-HYGIENE: /admin/ssot é TENANT-admin — `req.tenant`
      // é a AUTORIDADE de escopo; `req.query.tenantId` NUNCA amplia. Antes: sem query → options.tenantId
      // undefined → getMetrics CROSS-TENANT (vazamento). Agora: sempre escopa ao tenant autenticado; query
      // divergente → 403. PLATFORM-admin cross-tenant exigiria DECISION/rota/autoridade próprias (não implícito).
      if (req.query.tenantId && req.query.tenantId !== req.tenant.id) {
        return reply.status(403).send({
          ok: false,
          code: 'SSOT_ADMIN_TENANT_SCOPE_FORBIDDEN',
          message: 'tenantId fora do tenant autenticado (/admin/ssot é tenant-admin).',
        });
      }
      const options: {
        tenantId?: string;
        startDate?: Date;
        endDate?: Date;
      } = { tenantId: req.tenant.id };

      if (req.query.startDate) {
        options.startDate = new Date(req.query.startDate);
      }

      if (req.query.endDate) {
        options.endDate = new Date(req.query.endDate);
      }

      const metrics = await ssotObservabilityUtil.getMetrics(options);

      return reply.send({
        ok: true,
        data: metrics,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar métricas SSOT');
      return reply.status(500).send({
        ok: false,
        message: error instanceof Error ? error.message : 'Erro ao buscar métricas SSOT',
      });
    }
  });
};

export default ssotAdminRoutes;




