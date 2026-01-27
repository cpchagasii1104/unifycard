// backend/src/core/categories/ssot-admin.routes.ts
// Rotas administrativas para métricas SSOT
// Apenas role 'admin' pode acessar

import { FastifyPluginAsync } from 'fastify';
import { ssotObservabilityService } from './ssot-observability.service';

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
      const options: {
        tenantId?: string;
        startDate?: Date;
        endDate?: Date;
      } = {};

      if (req.query.tenantId) {
        options.tenantId = req.query.tenantId;
      }

      if (req.query.startDate) {
        options.startDate = new Date(req.query.startDate);
      }

      if (req.query.endDate) {
        options.endDate = new Date(req.query.endDate);
      }

      const metrics = await ssotObservabilityService.getMetrics(options);

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




