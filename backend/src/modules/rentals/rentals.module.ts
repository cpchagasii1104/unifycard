// backend/src/modules/rentals/rentals.module.ts
// Módulo de locações — F-RENTAL-RESOURCE-SURFACE-SLICE-A (DECISION-0151/0159).

import type { FastifyInstance } from 'fastify';
import rentableResourceRoutes from './rentable-resource.routes';

const rentalsModule = async (fastify: FastifyInstance) => {
  await fastify.register(rentableResourceRoutes, { prefix: '/rentable-resources' });
};

export default rentalsModule;
