// src/core/reputation/trust.routes.ts
// Rotas do Dashboard de Confiança (Contrato v1.3)
// FASE 10: ESCROW + PENALIDADES + RESPONSABILIZAÇÃO

import { FastifyPluginAsync } from 'fastify';
import { trustService } from './trust.service';
import { NotFoundError } from '@core/errors';
import { ensureUserActor } from '@modules/identity/actor-writer.service';

const trustRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /trust/me
   * Dashboard completo do próprio ator
   */
  fastify.get('/me', async (req, reply) => {
    if (!req.user || !req.tenant) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    try {
      // Resolver actor do usuário autenticado
      if (!req.user.id) {
        return reply.status(400).send({ error: 'ID do usuário não encontrado' });
      }
      const userActor = await ensureUserActor(req.tenant.id, req.user.id);

      if (!userActor?.actor_id) {
        return reply.status(400).send({ error: 'Actor não encontrado' });
      }

      const dashboard = await trustService.getDashboard(
        req.tenant.id,
        userActor.actor_id,
        'user'
      );

      return reply.status(200).send(dashboard);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return reply.status(404).send({ error: error.message });
      }
      console.error('Erro ao buscar dashboard de confiança:', error);
      return reply.status(500).send({ error: 'Erro interno do servidor' });
    }
  });

  /**
   * GET /trust/me/timeline
   * Timeline de score
   */
  fastify.get<{
    Querystring: { months?: number };
  }>('/me/timeline', async (req, reply) => {
    if (!req.user || !req.tenant) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    try {
      if (!req.user.id) {
        return reply.status(400).send({ error: 'ID do usuário não encontrado' });
      }
      const userActor = await ensureUserActor(req.tenant.id, req.user.id);

      if (!userActor?.actor_id) {
        return reply.status(400).send({ error: 'Actor não encontrado' });
      }

      const months = parseInt(req.query.months?.toString() || '12', 10);
      const timeline = await trustService.getScoreTimeline(
        req.tenant.id,
        userActor.actor_id,
        'user',
        months
      );

      return reply.status(200).send({ timeline });
    } catch (error) {
      console.error('Erro ao buscar timeline de score:', error);
      return reply.status(500).send({ error: 'Erro interno do servidor' });
    }
  });

  /**
   * GET /trust/actor/:actorId
   * Dashboard público de outro ator
   */
  fastify.get<{
    Params: { actorId: string };
  }>('/actor/:actorId', async (req, reply) => {
    if (!req.tenant) {
      return reply.status(401).send({ error: 'Tenant inválido' });
    }

    try {
      const { actorId } = req.params;

      // Buscar tipo do actor
      const { socialPortsRegistry } = await import('@core/social/ports-registry');
      const actorRepository = socialPortsRegistry.getActorRepository();
      const actor = await actorRepository.findById(req.tenant.id, actorId);

      if (!actor) {
        return reply.status(404).send({ error: 'Actor não encontrado' });
      }

      const dashboard = await trustService.getPublicDashboard(
        req.tenant.id,
        actorId,
        actor.actor_type as 'user' | 'page' | 'group'
      );

      return reply.status(200).send(dashboard);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return reply.status(404).send({ error: error.message });
      }
      console.error('Erro ao buscar dashboard público:', error);
      return reply.status(500).send({ error: 'Erro interno do servidor' });
    }
  });
};

export default trustRoutes;
export const trustModule = trustRoutes;

