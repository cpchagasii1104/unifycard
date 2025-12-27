// src/core/matching/matching.module.ts
// Módulo de Matching Humano

import { FastifyPluginAsync } from 'fastify';
import matchingRoutes from './matching.routes';

const matchingModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(matchingRoutes);
};

export default matchingModule;













