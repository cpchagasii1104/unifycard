// Financial Health Endpoint — GET /internal/financial/health

import type { FastifyPluginAsync } from 'fastify';
import { pool } from '@core/database/pool';
import { getFinancialHealth } from '@core/observability/financial-health';

const financialHealthController: FastifyPluginAsync = async (app) => {
  app.get('/financial/health', async (_req, reply) => {
    const health = await getFinancialHealth(pool);
    return reply.send(health);
  });
};

export default financialHealthController;