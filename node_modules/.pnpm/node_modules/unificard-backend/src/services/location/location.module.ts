// src/services/location/location.module.ts
// Módulo de localização (CEP, etc)

import { FastifyPluginAsync } from 'fastify';
import cepRoutes from './cep.routes';

const locationModule: FastifyPluginAsync = async (fastify) => {
  // Registrar rotas de CEP
  await fastify.register(cepRoutes, { prefix: '/location' });
};

export default locationModule;













