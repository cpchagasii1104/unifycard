// backend/src/modules/trust/trust.module.ts
// Módulo de Trust & Integrity Engine

import type { FastifyInstance } from 'fastify';
import trustRoutes from './trust.routes';

const trustModule = async (fastify: FastifyInstance) => {
  await fastify.register(trustRoutes, { prefix: '/api' });
};

export default trustModule;




