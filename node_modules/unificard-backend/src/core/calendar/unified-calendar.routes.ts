// backend/src/core/calendar/unified-calendar.routes.ts
// Rotas para AGENDA UNIFICADA

import type { FastifyInstance } from 'fastify';
import { unifiedCalendarService } from './unified-calendar.service';
import type { UnifiedCalendarFilters } from './unified-calendar.types';

const unifiedCalendarRoutes = async (fastify: FastifyInstance) => {
  /**
   * GET /unified-calendar
   * Busca agenda unificada consolidando todas as fontes
   * 
   * REGRAS:
   * - NÃO duplica dados
   * - Backend continua sendo source of truth
   * - Tudo que aparece deve dizer DE ONDE vem
   */
  fastify.get('/unified-calendar', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const filters: UnifiedCalendarFilters = {};

    if (query.actorId) filters.actorId = query.actorId;
    if (query.serviceId) filters.serviceId = query.serviceId;
    if (query.eventId) filters.eventId = query.eventId;
    if (query.source) filters.source = query.source as any;
    if (query.type) filters.type = query.type as any;
    if (query.startTimeFrom) filters.startTimeFrom = new Date(query.startTimeFrom);
    if (query.startTimeTo) filters.startTimeTo = new Date(query.startTimeTo);
    if (query.limit) filters.limit = parseInt(query.limit);
    if (query.offset) filters.offset = parseInt(query.offset);

    try {
      const entries = await unifiedCalendarService.getUnifiedCalendar(tenantId, filters);
      return reply.send({ entries });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(error.statusCode || 500).send({
        error: error.message || 'Erro ao buscar agenda unificada',
      });
    }
  });
};

export { unifiedCalendarRoutes };



