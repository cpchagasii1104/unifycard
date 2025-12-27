// src/core/orchestrator/orchestrator.module.ts
import { FastifyPluginAsync } from 'fastify';
import orchestratorRoutes from './orchestrator.routes';

const orchestratorModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(orchestratorRoutes);
};

export default orchestratorModule;








