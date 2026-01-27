// backend/src/modules/reporting/reporting.module.ts
// Módulo de Reporting Institucional

import type { FastifyInstance } from 'fastify';
import reportingRoutes from './reporting.routes';

const reportingModule = async (fastify: FastifyInstance) => {
  await fastify.register(reportingRoutes, { prefix: '/api' });
};

export default reportingModule;




