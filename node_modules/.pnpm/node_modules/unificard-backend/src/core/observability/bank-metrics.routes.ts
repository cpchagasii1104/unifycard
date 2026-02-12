// backend/src/core/observability/bank-metrics.routes.ts
// CONTINUOUS PRODUCTION: Rotas para observabilidade mínima

import { FastifyPluginAsync } from 'fastify';
import { bankMetricsService } from './bank-metrics.service';

const bankMetricsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /admin/metrics/summary
   * Retorna resumo de métricas do Unify Bank
   */
  fastify.get('/summary', async (req, reply) => {
    // TODO: Adicionar autenticação admin quando necessário
    // Por enquanto, permitir acesso para desenvolvimento

    try {
      const summary = bankMetricsService.getSummary();
      
      return reply.status(200).send({
        success: true,
        metrics: summary,
      });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'Error fetching metrics');
      return reply.status(500).send({
        error: err.message || 'Failed to fetch metrics',
      });
    }
  });
};

export default bankMetricsRoutes;







