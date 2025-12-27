// src/modules/schedule/schedule.module.ts
import { FastifyPluginAsync } from 'fastify';
import scheduleRoutes from './schedule.routes';

const scheduleModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(scheduleRoutes);
};

export default scheduleModule;








