// backend/src/core/authorization/business-authorization.module.ts
// Módulo de Autorização de Negócio

import { FastifyPluginAsync } from 'fastify';
import businessAuthorizationRoutes from './business-authorization.routes';

const businessAuthorizationModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(businessAuthorizationRoutes);
};

export default businessAuthorizationModule;




