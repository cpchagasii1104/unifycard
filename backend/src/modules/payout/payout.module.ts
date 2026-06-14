// backend/src/modules/payout/payout.module.ts
// Módulo de Payout Engine

import type { FastifyInstance } from 'fastify';
import payoutRoutes from './payout.routes';
import payoutRequestRoutes from './payout-request.routes';
import payoutDecisionRoutes from './payout-decision.routes';

const payoutModule = async (fastify: FastifyInstance) => {
  await fastify.register(payoutRoutes, { prefix: '/api' });
  // F-PAYOUT-REQUEST-ONLY-ENTRYPOINT: POST /api/payouts/requests (request-only; não aprova/executa).
  await fastify.register(payoutRequestRoutes, { prefix: '/api' });
  // F-PAYOUT-APPROVE-ENDPOINT-CORE-AUTHORITY (CAMINHO B): POST /api/payouts/requests/:id/decision
  // (FAIL-CLOSED: requester!=approver + política ausente → PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED; não aprova/executa).
  await fastify.register(payoutDecisionRoutes, { prefix: '/api' });
};

export default payoutModule;




