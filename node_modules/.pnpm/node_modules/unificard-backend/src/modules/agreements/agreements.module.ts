// backend/src/modules/agreements/agreements.module.ts
// Módulo de Negociação Assistida e Registro de Acordos

import type { FastifyInstance } from 'fastify';
import agreementRoutes from './agreement.routes';

const agreementsModule = async (fastify: FastifyInstance) => {
  await fastify.register(agreementRoutes, { prefix: '/api' });
};

export default agreementsModule;




