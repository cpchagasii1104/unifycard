// backend/src/modules/marketplace/business-segment.routes.ts
// SPRINT 81: Rotas REST para Business Segment

import type { FastifyInstance } from 'fastify';
import { businessSegmentService } from './business-segment.service';
import type { SetBusinessSegmentInput } from './business-segment.types';
import { AppError, BadRequestError, NotFoundError, UnauthorizedError, ForbiddenError, InternalServerError, ConflictError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

const businessSegmentRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /business-segment
   * Define segmento de negócio
   */
  fastify.post<{ Body: SetBusinessSegmentInput }>('/business-segment', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
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
      throw new NotFoundError('Business segment não encontrado');
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
      throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
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




