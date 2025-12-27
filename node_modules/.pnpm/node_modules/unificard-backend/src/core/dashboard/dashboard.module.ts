// src/core/dashboard/dashboard.module.ts

import { FastifyPluginAsync } from 'fastify';
import dashboardRoutes from './dashboard.routes';
import dailyMetricsRoutes from './daily-metrics.routes';

const dashboardModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(dashboardRoutes);
  await fastify.register(dailyMetricsRoutes, { prefix: '/metrics' });
};

export default dashboardModule;



