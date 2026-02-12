// backend/src/modules/system-notifications/system-notifications.module.ts
// Módulo de Notificações In-App

import { FastifyPluginAsync } from 'fastify';
import systemNotificationRoutes from './system-notification.routes';

const systemNotificationsModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(systemNotificationRoutes);
};

export default systemNotificationsModule;




