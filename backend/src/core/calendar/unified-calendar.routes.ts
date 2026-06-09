// backend/src/core/calendar/unified-calendar.routes.ts
// Rotas para AGENDA UNIFICADA

import type { FastifyInstance } from 'fastify';
import { unifiedCalendarService } from './unified-calendar.service';
import { authorizationService } from '@core/authorization/authorization.service';
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

    // 🔴 DECISION-0113 canal 3 (query): a agenda unificada de um actor (availability + eventos) é PII
    // operacional. `actorId` declarado na query é HINT, não autoridade. Com `actorId` → exigir representar
    // o actor filtrado (canRepresentActor) ANTES de ler a agenda (fail-closed → 403); 401 sem user.
    // SEM `actorId`: comportamento atual preservado (read-model do tenant) — fora do escopo desta fatia.
    if (query.actorId) {
      const userId = (req as { user?: { id?: string } }).user?.id;
      if (!userId) {
        return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.id)' });
      }
      let canRep = false;
      try {
        canRep = await authorizationService.canRepresentActor(tenantId, userId, query.actorId);
      } catch {
        canRep = false;
      }
      if (!canRep) {
        return reply.status(403).send({
          error: 'Sem autoridade sobre o actor (canRepresentActor)',
          code: 'UNIFIED_CALENDAR_ACTOR_NOT_REPRESENTABLE',
        });
      }
    }

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



