// src/core/economy/economy.module.ts
import { FastifyPluginAsync } from 'fastify';
import accountRoutes from './accounts/account.routes';
import transactionRoutes from './transactions/transaction.routes';
import ledgerRoutes from './ledger/ledger.routes';
import distributionRoutes from './distribution/distribution.routes';
// Fund routes são registrados separadamente no server.ts

const economyModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(accountRoutes, { prefix: '/accounts' });
  await fastify.register(transactionRoutes, { prefix: '/transactions' });
  await fastify.register(ledgerRoutes, { prefix: '/ledger' });
  await fastify.register(distributionRoutes, { prefix: '/distribution' });
};

export default economyModule;
