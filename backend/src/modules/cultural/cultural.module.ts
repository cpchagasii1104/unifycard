// src/modules/cultural/cultural.module.ts
// Módulo de Cultura & Eventos - FASE 16
// Registra rotas de PACs e eventos culturais

import { FastifyPluginAsync } from 'fastify';
import culturalRoutes from './cultural.routes';

const culturalModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(culturalRoutes, { prefix: '/cultural' });
};

export default culturalModule;













