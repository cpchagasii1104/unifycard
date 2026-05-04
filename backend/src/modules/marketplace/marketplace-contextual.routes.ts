// Rotas: marketplace contextual (intenção → grafo → ofertantes por concept)

import type { FastifyInstance } from 'fastify';
import { marketplaceContextualService } from './marketplace-contextual.service';
import { AppError, BadRequestError, InternalServerError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

const marketplaceContextualRoutes = async (fastify: FastifyInstance) => {
  /**
   * GET /marketplace/contextual?intent=churrasco
   * Usa o tenant da sessão para expandir o grafo (category_relations desse tenant).
   */
  fastify.get<{
    Querystring: { intent?: string };
  }>('/marketplace/contextual', async (req, reply) => {
    if (!req.tenant) {
      throw new BadRequestError('Tenant required', ErrorCode.MISSING_TENANT);
    }

    const intent = req.query.intent?.trim() ?? '';
    if (!intent) {
      throw new BadRequestError('intent is required', ErrorCode.VALIDATION_ERROR);
    }

    try {
      const data = await marketplaceContextualService.getContextualBundle(req.tenant.id, intent);
      return reply.send(data);
    } catch (err) {
      req.log.error({ err }, 'marketplace contextual');
      if (err instanceof AppError) throw err;
      throw new InternalServerError('Failed to load contextual bundle');
    }
  });
};

export default marketplaceContextualRoutes;