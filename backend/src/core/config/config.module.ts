// src/core/config/config.module.ts
import { FastifyPluginAsync } from 'fastify';
import configRoutes from './config.routes';

const configModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(configRoutes);
};

export default configModule;
