// src/core/feed/feed.module.ts
// Módulo de Feed Contextual

import { FastifyPluginAsync } from 'fastify';
import feedRoutes from './feed.routes';

const feedModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(feedRoutes);
};

export default feedModule;













