// backend/src/modules/payout/payout.module.ts
// Módulo de Payout Engine

import type { FastifyInstance } from 'fastify';
import payoutRoutes from './payout.routes';

const payoutModule = async (fastify: FastifyInstance) => {
  await fastify.register(payoutRoutes, { prefix: '/api' });
};

export default payoutModule;




