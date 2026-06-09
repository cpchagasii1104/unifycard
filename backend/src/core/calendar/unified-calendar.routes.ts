// backend/src/core/calendar/unified-calendar.routes.ts
// Rotas para AGENDA UNIFICADA

import type { FastifyInstance } from 'fastify';
import { unifiedCalendarService } from './unified-calendar.service';
import { authorizationService } from '@core/authorization/authorization.service';
import { runQueriesWithTenant } from '@core/database/pool';
import type { UnifiedCalendarFilters } from './unified-calendar.types';

/**
 * 🔴 DECISION-0113 — resolve, SOMENTE-LEITURA, o actor 'user' do próprio req.user (server-side).
 * NÃO cria actor (sem ensureUserActor — proibido side-effect em GET). Espelha a regra normativa do
 * reader C1 (DECISION-0069): 0 actor → null (sem agenda própria); >1 → ambíguo fail-closed.
 */
async function resolveSelfUserActorReadOnly(
  tenantId: string,
  userId: string
): Promise<{ actorId: string } | null | 'AMBIGUOUS'> {
  const rows = await runQueriesWithTenant<{ actor_id: string }>(
    tenantId,
    `SELECT actor_id FROM actors WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user'`,
    [tenantId, userId]
  );
  if (rows.length === 0) return null;
  if (rows.length > 1) return 'AMBIGUOUS';
  return { actorId: rows[0].actor_id };
}

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

    // 🔴 DECISION-0113 canal 3 (query): a agenda unificada (availability + eventos) é PII operacional.
    // A leitura SEMPRE é escopada a UM actor resolvido server-side — nunca o tenant inteiro.
    //   • COM `actorId` na query: é HINT → exigir representar o actor (canRepresentActor) → 403 fail-closed.
    //   • SEM `actorId`: NÃO é passe livre p/ ver o tenant → resolve o actor 'user' do PRÓPRIO req.user
    //     (server-side, read-only). 0 actor próprio → agenda vazia (nunca tenant-wide); >1 → 409 ambíguo.
    // Visão admin/tenant-wide de calendário fica FORA de escopo (exige permissão operacional própria).
    const userId = (req as { user?: { id?: string } }).user?.id;
    if (!userId) {
      return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.id)' });
    }

    let targetActorId: string;
    if (query.actorId) {
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
      targetActorId = query.actorId;
    } else {
      const self = await resolveSelfUserActorReadOnly(tenantId, userId);
      if (self === 'AMBIGUOUS') {
        return reply.status(409).send({
          error: 'Identidade de actor ambígua para o usuário',
          code: 'USER_ACTOR_AMBIGUOUS',
        });
      }
      if (!self) {
        // Sem user-actor próprio → sem agenda própria. Fail-closed: lista vazia, NUNCA o tenant inteiro.
        return reply.send({ entries: [] });
      }
      targetActorId = self.actorId;
    }

    // actorId SEMPRE presente — a leitura é escopada ao actor resolvido; nunca `getUnifiedCalendar(tenantId, {})`.
    const filters: UnifiedCalendarFilters = { actorId: targetActorId };

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



