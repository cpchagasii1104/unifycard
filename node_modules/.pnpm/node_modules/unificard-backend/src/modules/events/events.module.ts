// src/modules/events/events.module.ts
import { FastifyPluginAsync } from 'fastify';
import eventsRoutes from './events.routes';

const eventsModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(eventsRoutes);
};

export default eventsModule;








