// src/core/availability/availability.module.ts
// Módulo do CORE de UNIFIED AVAILABILITY
// 🔴 BLINDAGEM: Availability NÃO decide quem pode agendar
// 🔴 BLINDAGEM: Availability NÃO faz pagamento
// 🔴 BLINDAGEM: Availability NÃO faz matching

import { FastifyPluginAsync } from 'fastify';
import { unifiedAvailabilityRoutes } from './unified-availability.routes';

export const availabilityModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(unifiedAvailabilityRoutes);
};

