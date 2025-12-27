// src/core/opportunity/opportunity.module.ts
// Módulo de Oportunidades Suaves

import { FastifyPluginAsync } from 'fastify';
import opportunityRoutes from './opportunity.routes';

const opportunityModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(opportunityRoutes);
};

export default opportunityModule;













