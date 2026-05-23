// src/core/economy/ledger/ledger.routes.ts
// Rotas legadas desativadas — SSOT em /api/reporting (bank_*).
import type { FastifyPluginAsync, FastifyReply } from 'fastify';

const migrated = (reply: FastifyReply) =>
  reply.status(503).send({
    error: 'ENDPOINT_MIGRATED',
    message: 'Dados financeiros disponíveis via /api/reporting',
  });

const ledgerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/account/:accountId', async (_req, reply) => migrated(reply));
  fastify.get('/transaction/:transactionId', async (_req, reply) => migrated(reply));
  fastify.get('/summary/:accountId', async (_req, reply) => migrated(reply));
  fastify.get('/audit/:accountId', async (_req, reply) => migrated(reply));
};

export default ledgerRoutes;
