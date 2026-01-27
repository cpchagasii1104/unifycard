// src/modules/dispatch/dispatch.module.ts
// Módulo do Domínio de DISPATCH DE OPORTUNIDADES
// 🔴 BLINDAGEM: Dispatch é NOTIFICAÇÃO, não decisão

import { FastifyPluginAsync } from 'fastify';
import { opportunityDispatchRoutes } from './opportunity-dispatch.routes';

export const dispatchModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(opportunityDispatchRoutes);
};

