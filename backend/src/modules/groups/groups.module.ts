// src/modules/groups/groups.module.ts

import { FastifyPluginAsync } from 'fastify';
import groupsRoutes from './groups.routes';
import groupsInsightsRoutes from './groups.insights.routes';

const groupsModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(groupsRoutes);
  await fastify.register(groupsInsightsRoutes, { prefix: '/insights' });
};

export default groupsModule;








