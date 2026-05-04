// backend/src/modules/marketplace/tax-profile.routes.ts
// SPRINT 80: Rotas REST para Tax Profile

import type { FastifyInstance } from 'fastify';
import { taxProfileService } from './tax-profile.service';
import type { SetTaxProfileInput } from './tax-profile.types';
import { AppError, BadRequestError, NotFoundError, UnauthorizedError, ForbiddenError, InternalServerError, ConflictError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

const taxProfileRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /tax-profile
   * Define perfil fiscal
   */
  fastify.post<{ Body: SetTaxProfileInput }>('/tax-profile', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
    }

    const taxProfile = await taxProfileService.setTaxProfile(
      tenantId,
      req.body,
      actionContext.actorId
    );

    return reply.status(201).send(taxProfile);
  });

  /**
   * GET /tax-profile
   * Busca perfil fiscal
   */
  fastify.get('/tax-profile', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const taxProfile = await taxProfileService.getTaxProfile(tenantId);

    if (!taxProfile) {
      throw new NotFoundError('Tax profile não encontrado');
    }

    return reply.send(taxProfile);
  });

  /**
   * PATCH /tax-profile
   * Atualiza perfil fiscal
   */
  fastify.patch<{ Body: Partial<SetTaxProfileInput> }>('/tax-profile', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
    }

    const taxProfile = await taxProfileService.updateTaxProfile(
      tenantId,
      req.body,
      actionContext.actorId
    );

    return reply.send(taxProfile);
  });
};

export default taxProfileRoutes;




