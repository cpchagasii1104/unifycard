// src/core/reputation/reputation.module.ts
import { FastifyPluginAsync } from 'fastify';
import reputationRoutes from './reputation.routes';

const reputationModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(reputationRoutes);
};

export default reputationModule;
