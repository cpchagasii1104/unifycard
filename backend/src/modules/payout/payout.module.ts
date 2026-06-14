// backend/src/modules/payout/payout.module.ts
// Módulo de Payout Engine

import type { FastifyInstance } from 'fastify';
import payoutRoutes from './payout.routes';
import payoutRequestRoutes from './payout-request.routes';

const payoutModule = async (fastify: FastifyInstance) => {
  await fastify.register(payoutRoutes, { prefix: '/api' });
  // F-PAYOUT-REQUEST-ONLY-ENTRYPOINT: POST /api/payouts/requests (request-only; não aprova/executa).
  await fastify.register(payoutRequestRoutes, { prefix: '/api' });
};

export default payoutModule;




