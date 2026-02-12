// backend/src/core/publication/publication-engine.module.ts
// Módulo do Motor Canônico de Publicação, Visibilidade e Convites

import { FastifyPluginAsync } from 'fastify';
import { publicationEngineRoutes } from './publication-engine.routes';

export const publicationEngineModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(publicationEngineRoutes, { prefix: '/publication' });
};


