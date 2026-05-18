// backend/src/core/actor-coordination/recent-counterparts.routes.ts
// 2026-05-18 P2 — HTTP route para Índice de Coordenação Humana (semente)
//
// GET /actors/:actorId/recent-counterparts?windowDays=&limit=
//
// Read-only. Authority validada via capability resolver (mesma cadeia
// SSOT: actors + company_users + actor_delegations). 403 se sem authority.

import type { FastifyPluginAsync } from 'fastify';
import { recentCounterpartsService } from './recent-counterparts.service';

const recentCounterpartsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Params: { actorId: string };
    Querystring: { windowDays?: string; limit?: string };
  }>('/:actorId/recent-counterparts', async (req, reply) => {
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

    const windowDays = req.query.windowDays ? parseInt(req.query.windowDays, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;

    try {
      const result = await recentCounterpartsService.resolveForUser(
        req.tenant.id,
        actorId,
        req.user.id,
        {
          windowDays: windowDays && !isNaN(windowDays) ? windowDays : undefined,
          limit: limit && !isNaN(limit) ? limit : undefined,
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
        'recent-counterparts resolver error'
      );
      return reply.status(500).send({
        error: err.message || 'Failed to resolve recent counterparts',
      });
    }
  });
};

export default recentCounterpartsRoutes;
