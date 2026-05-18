// backend/src/core/profile-inference/profile-inference.routes.ts
// 2026-05-18 P2 — HTTP route para Profile Inference MVP
//
// GET /actors/:actorId/inferred-profile?windowDaysEvents=&limitAffinities=&limitCommunities=
//
// Read-only. Authority validada via capability resolver. 403 se sem authority.

import type { FastifyPluginAsync } from 'fastify';
import { profileInferenceService } from './profile-inference.service';

const profileInferenceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Params: { actorId: string };
    Querystring: { windowDaysEvents?: string; limitAffinities?: string; limitCommunities?: string };
  }>('/:actorId/inferred-profile', async (req, reply) => {
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

    const parseOptional = (s?: string) => {
      if (!s) return undefined;
      const n = parseInt(s, 10);
      return isNaN(n) ? undefined : n;
    };

    try {
      const result = await profileInferenceService.resolveForUser(
        req.tenant.id,
        actorId,
        req.user.id,
        {
          windowDaysEvents: parseOptional(req.query.windowDaysEvents),
          limitAffinities: parseOptional(req.query.limitAffinities),
          limitCommunities: parseOptional(req.query.limitCommunities),
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
        'profile-inference resolver error'
      );
      return reply.status(500).send({
        error: err.message || 'Failed to resolve inferred profile',
      });
    }
  });
};

export default profileInferenceRoutes;
