// backend/src/core/compatibility/compatibility.module.ts
// Módulo de Compatibilidade Técnica

import { FastifyPluginAsync } from 'fastify';
import compatibilityRoutes from './compatibility-engine.routes';

const compatibilityModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(compatibilityRoutes);
};

export default compatibilityModule;




