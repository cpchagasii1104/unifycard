// src/core/city/city-readiness/city-readiness.module.ts
// Módulo de prontidão de cidade - READ-ONLY

import { FastifyPluginAsync } from 'fastify';
import cityReadinessRoutes from './city-readiness.routes';

const cityReadinessModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cityReadinessRoutes);
};

export default cityReadinessModule;



