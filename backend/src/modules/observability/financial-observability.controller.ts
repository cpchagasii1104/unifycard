// Financial Observability — endpoint de métricas (debug/internal)

import type { FastifyPluginAsync } from 'fastify';
import { getFinancialMetrics } from '@core/observability/financial-metrics';

const financialObservabilityController: FastifyPluginAsync = async (fastify) => {
  fastify.get('/financial/metrics', async (_req, reply) => {
    return reply.send({
      metrics: getFinancialMetrics(),
    });
  });
};

export default financialObservabilityController;