// src/core/events/event.module.ts
// Módulo de eventos conforme CONTRATO DE EVENTOS v1
// FASE 4: BACKEND DOMAIN (EVENTS CORE)

import { FastifyPluginAsync } from 'fastify';
import eventRoutes from './event.routes';

const eventModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(eventRoutes);
};

export default eventModule;
export { eventModule };













