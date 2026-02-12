// backend/src/modules/marketplace/business-segment.routes.ts
// SPRINT 81: Rotas REST para Business Segment

import type { FastifyInstance } from 'fastify';
import { businessSegmentService } from './business-segment.service';
import type { SetBusinessSegmentInput } from './business-segment.types';

const businessSegmentRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /business-segment
   * Define segmento de negócio
   */
  fastify.post<{ Body: SetBusinessSegmentInput }>('/business-segment', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    const segment = await businessSegmentService.setSegment(
      tenantId,
      req.body,
      actionContext.actorId
    );

    return reply.status(201).send(segment);
  });

  /**
   * GET /business-segment
   * Busca segmento de negócio
   */
  fastify.get('/business-segment', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const segment = await businessSegmentService.getSegment(tenantId);

    if (!segment) {
      return reply.status(404).send({ error: 'Business segment não encontrado' });
    }

    return reply.send(segment);
  });

  /**
   * PATCH /business-segment
   * Atualiza segmento de negócio
   */
  fastify.patch<{ Body: Partial<SetBusinessSegmentInput> }>('/business-segment', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    const segment = await businessSegmentService.updateSegment(
      tenantId,
      req.body,
      actionContext.actorId
    );

    return reply.send(segment);
  });
};

export default businessSegmentRoutes;





