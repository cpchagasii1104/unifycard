// backend/src/core/ai/ai.module.ts
import { FastifyPluginAsync } from 'fastify';
import aiRoutes from './ai.routes';
import approvalRoutes from './approval/approval.routes';
import strategyRoutes from './strategy/strategy.routes';
import fileReaderRoutes from './files/file-reader.routes';
import patchRoutes from './patch/patch.routes';
import networkRoutes from './network/network.routes';
import packagesRoutes from './packages/packages.routes';
import tasksRoutes from './tasks/tasks.routes';

const aiModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(aiRoutes);
  await fastify.register(approvalRoutes, { prefix: '/approval' });
  await fastify.register(strategyRoutes);
  await fastify.register(fileReaderRoutes, { prefix: '/files' });
  await fastify.register(patchRoutes, { prefix: '/patch' });
  await fastify.register(networkRoutes, { prefix: '/network' });
  await fastify.register(packagesRoutes, { prefix: '/packages' });
  await fastify.register(tasksRoutes, { prefix: '/tasks' });
};

export default aiModule;

