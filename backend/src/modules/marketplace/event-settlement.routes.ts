// backend/src/modules/marketplace/event-settlement.routes.ts
// SPRINT 84: EVENT SETTLEMENT + BILHETERIA FINANCEIRA

import type { FastifyInstance } from 'fastify';
import { eventSettlementService } from './event-settlement.service';

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
      return reply.status(404).send({ error: 'Settlement não encontrado' });
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
      return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
    }

    // Buscar settlement
    const settlement = await eventSettlementService.getSettlementByEvent(tenantId, eventId);

    if (!settlement) {
      return reply.status(404).send({ error: 'Settlement não encontrado' });
    }

    // Liquidar
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

