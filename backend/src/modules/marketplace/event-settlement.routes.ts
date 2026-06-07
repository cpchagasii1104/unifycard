// backend/src/modules/marketplace/event-settlement.routes.ts
// SPRINT 84: EVENT SETTLEMENT + BILHETERIA FINANCEIRA

import type { FastifyInstance } from 'fastify';
import { eventSettlementService } from './event-settlement.service';
import { authorizationService } from '@core/authorization/authorization.service';
import { runQueryWithTenant } from '@core/database/pool';
import { BadRequestError, NotFoundError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

const eventSettlementRoutes = async (fastify: FastifyInstance) => {
  /**
   * GET /events/:id/settlement
   * Busca settlement de evento
   */
  fastify.get<{
    Params: { id: string };
  }>('/events/:id/settlement', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const eventId = req.params.id;

    const settlement = await eventSettlementService.getSettlementByEvent(tenantId, eventId);

    if (!settlement) {
      throw new NotFoundError('Settlement não encontrado');
    }

    return reply.send({ settlement });
  });

  /**
   * POST /events/:id/settlement/settle
   * Liquida settlement de evento
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      settlementId?: string;
    };
  }>('/events/:id/settlement/settle', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const eventId = req.params.id;
    const actionContext = (req as any).actionContext;
    const actorId = actionContext?.actorId;

    if (!actorId) {
      throw new BadRequestError('ActionContext.actorId é obrigatório', ErrorCode.MISSING_ACTOR);
    }

    const settlement = await eventSettlementService.getSettlementByEvent(tenantId, eventId);

    if (!settlement) {
      throw new NotFoundError('Settlement não encontrado');
    }

    // 🔴 DECISION-0113 fatia 3 (F3.1): autoridade server-side antes de liquidar (escrita money real).
    // Quem liquida = quem representa o ORGANIZER do evento (`events.actor_id` — link canônico, mesmo
    // usado por checkOwnership('events')). `actionContext.actorId` é hint, não autoridade.
    const userId = (req as { user?: { id?: string } }).user?.id;
    if (!userId) {
      return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.id) para liquidar evento' });
    }
    const ev = await runQueryWithTenant<{ actor_id: string | null }>(
      tenantId,
      `SELECT actor_id::text AS actor_id FROM events WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [eventId, tenantId],
    );
    const organizerActorId = ev?.actor_id;
    if (!organizerActorId) {
      // sem organizer resolvível → não dá para provar autoridade → fail-closed
      return reply.status(403).send({ error: 'Evento sem organizer resolvível — liquidação bloqueada', code: 'EVENT_ORGANIZER_UNRESOLVED' });
    }
    let canSettle = false;
    try {
      canSettle = await authorizationService.canRepresentActor(tenantId, userId, organizerActorId);
    } catch {
      canSettle = false;
    }
    if (!canSettle) {
      return reply.status(403).send({
        error: 'Apenas quem representa o organizer do evento pode liquidar (DECISION-0113)',
        code: 'EVENT_SETTLE_FORBIDDEN',
      });
    }

    // Autoria server-side: actor = organizer provado; user = principal autenticado (nunca o actorId cru).
    const settledSettlement = await eventSettlementService.settleEvent(
      tenantId,
      settlement.id,
      {
        settlementId: req.body.settlementId,
      },
      organizerActorId,
      userId
    );

    return reply.send({ settlement: settledSettlement });
  });
};

export default eventSettlementRoutes;