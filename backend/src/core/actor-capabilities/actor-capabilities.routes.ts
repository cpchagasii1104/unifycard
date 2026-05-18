// backend/src/core/actor-capabilities/actor-capabilities.routes.ts
// 2026-05-18 P1 — Capability Resolver MVP HTTP route
//
// GET /actors/:actorId/capabilities
//
// Retorna agregação READ-ONLY de capabilities efetivas para o actor.
// Sempre exige usuário autenticado + tenant + authority sobre o actor.
//
// Memória vinculada: project_home_contextual_modelo_2026-05-18.md (P1)
// DT-PRESSURE-CAPABILITY-RESOLVER-MVP — fechada quando esta rota mergeada.

import type { FastifyPluginAsync } from 'fastify';
import { actorCapabilitiesService } from './actor-capabilities.service';

const actorCapabilitiesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { actorId: string } }>(
    '/:actorId/capabilities',
    async (req, reply) => {
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

      try {
        const result = await actorCapabilitiesService.resolveForUser(
          req.tenant.id,
          actorId,
          req.user.id
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
          'capability resolver error'
        );
        return reply.status(500).send({
          error: err.message || 'Failed to resolve capabilities',
        });
      }
    }
  );
};

export default actorCapabilitiesRoutes;
