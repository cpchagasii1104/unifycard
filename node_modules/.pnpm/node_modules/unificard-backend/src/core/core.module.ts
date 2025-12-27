// src/core/core.module.ts
// Módulo CORE - Fonte única de identidade e dados do ecossistema

import { FastifyPluginAsync } from 'fastify';
import coreRoutes from './core.routes';

const coreModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(coreRoutes);
};

export default coreModule;
















