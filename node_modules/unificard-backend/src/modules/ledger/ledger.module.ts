// backend/src/modules/ledger/ledger.module.ts
// Módulo de Ledger Contábil Canônico

import type { FastifyInstance } from 'fastify';
import ledgerRoutes from './ledger.routes';

const ledgerModule = async (fastify: FastifyInstance) => {
  await fastify.register(ledgerRoutes, { prefix: '/api' });
};

export default ledgerModule;




