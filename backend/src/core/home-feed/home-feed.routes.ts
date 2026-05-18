// backend/src/core/home-feed/home-feed.routes.ts
// 2026-05-18 P2 — HTTP route para Feed multi-vetor v1
//
// GET /actors/:actorId/home-feed?limit=&compromissoWindowDays=
//
// Read-only. Authority validada via capability resolver. 403 se sem authority.

import type { FastifyPluginAsync } from 'fastify';
import { homeFeedService } from './home-feed.service';

const homeFeedRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Params: { actorId: string };
    Querystring: { limit?: string; compromissoWindowDays?: string };
  }>('/:actorId/home-feed', async (req, reply) => {
    if (!req.user?.id) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant context required' });
    }
    const { actorId } = req.params;
    if (!actorId || typeof actorId !== 'string') {
      return reply.status(400).send({ error: 'Invalid actorId' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const compromissoWindowDays = req.query.compromissoWindowDays
      ? parseInt(req.query.compromissoWindowDays, 10)
      : undefined;

    try {
      const result = await homeFeedService.resolveForUser(
        req.tenant.id,
        actorId,
        req.user.id,
        {
          limit: limit && !isNaN(limit) ? limit : undefined,
          compromissoWindowDays:
            compromissoWindowDays && !isNaN(compromissoWindowDays)
              ? compromissoWindowDays
              : undefined,
        }
      );

      if (!result) {
        return reply.status(403).send({
          error: 'Actor not found or user has no authority over actor',
        });
      }

      return reply.status(200).send(result);
    } catch (error) {
      const err = error as Error;
      req.log.error(
        { err: error, actorId, userId: req.user.id, tenantId: req.tenant.id },
        'home-feed resolver error'
      );
      return reply.status(500).send({
        error: err.message || 'Failed to resolve home feed',
      });
    }
  });
};

export default homeFeedRoutes;
