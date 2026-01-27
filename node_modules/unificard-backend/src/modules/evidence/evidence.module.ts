// backend/src/modules/evidence/evidence.module.ts
// Módulo de Evidências & Resolução de Disputas

import type { FastifyInstance } from 'fastify';
import evidenceRoutes from './evidence.routes';

const evidenceModule = async (fastify: FastifyInstance) => {
  await fastify.register(evidenceRoutes, { prefix: '/api' });
};

export default evidenceModule;




