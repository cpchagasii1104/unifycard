// src/core/profile/profile.module.ts

import { FastifyPluginAsync } from 'fastify';
import profileRoutes from './profile.routes';

const profileModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(profileRoutes);
};

export default profileModule;



