// backend/src/modules/escrow/escrow.module.ts
// Módulo de Pagamentos com Escrow e Marcos de Execução

import type { FastifyInstance } from 'fastify';
import escrowRoutes from './escrow.routes';

const escrowModule = async (fastify: FastifyInstance) => {
  await fastify.register(escrowRoutes, { prefix: '/api' });
};

export default escrowModule;




