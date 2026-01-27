// backend/src/modules/risk-command-center/risk-command-center.module.ts
// Módulo de Risk & Trust Command Center

import type { FastifyInstance } from 'fastify';
import riskDashboardRoutes from './risk-dashboard.routes';

const riskCommandCenterModule = async (fastify: FastifyInstance) => {
  await fastify.register(riskDashboardRoutes, { prefix: '/api' });
};

export default riskCommandCenterModule;




