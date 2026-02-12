// backend/src/core/calendar/unified-calendar.module.ts
// Módulo para AGENDA UNIFICADA

import { FastifyPluginAsync } from 'fastify';
import { unifiedCalendarRoutes } from './unified-calendar.routes';

export const unifiedCalendarModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(unifiedCalendarRoutes);
};



