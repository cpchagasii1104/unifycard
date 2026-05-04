// backend/src/modules/marketplace/event-settlement.routes.ts
// SPRINT 84: EVENT SETTLEMENT + BILHETERIA FINANCEIRA

import type { FastifyInstance } from 'fastify';
import { eventSettlementService } from './event-settlement.service';
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

    const settledSettlement = await eventSettlementService.settleEvent(
      tenantId,
      settlement.id,
      {
        settlementId: req.body.settlementId,
      },
      actorId,
      actorId
    );

    return reply.send({ settlement: settledSettlement });
  });
};

export default eventSettlementRoutes;