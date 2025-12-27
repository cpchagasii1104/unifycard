// src/modules/events/organizers/organizers.module.ts
import { FastifyPluginAsync } from 'fastify';
import organizersRoutes from './organizers.routes';

const organizersModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(organizersRoutes);
};

export default organizersModule;








