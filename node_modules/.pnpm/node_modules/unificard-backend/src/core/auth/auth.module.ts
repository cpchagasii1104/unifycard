// src/core/auth/auth.module.ts
import { FastifyPluginAsync } from 'fastify';
import authRoutes from '@core/auth/auth.routes';

const authModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(authRoutes);
};

export default authModule;
