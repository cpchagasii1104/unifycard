// src/core/profile/profile-learning.routes.ts
// Rotas para perfil de aprendizado/trilha

import { FastifyPluginAsync } from 'fastify';
import { HttpError } from '../errors/http-error';
import { profileLearningService } from './profile-learning.service';

const profileLearningRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /profile/learning
   * Busca perfil de aprendizado do usuário autenticado
   */
  fastify.get('/learning', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const profile = await profileLearningService.getLearningProfile(
        req.tenant.id,
        req.user.id
      );
      const data = profile || {
        globalUserId: '',
        learnings: [],
        preferences: {},
        metadata: {},
      };
      return reply.send({ ok: true, data });
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.status(error.statusCode).send({ ok: false, message: error.message });
      }
      fastify.log.error({ err: error }, 'Erro ao buscar perfil de aprendizado');
      return reply.status(500).send({
        ok: false,
        message: 'Erro ao buscar perfil de aprendizado',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * PUT /profile/learning
   * Atualiza perfil de aprendizado do usuário autenticado
   */
  fastify.put('/learning', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const input = req.body as any;
      const profile = await profileLearningService.updateLearningProfile(
        req.tenant.id,
        req.user.id,
        input
      );
      return reply.send({ ok: true, data: profile });
    } catch (error) {
      if (error instanceof HttpError) {
        return reply.status(error.statusCode).send({ ok: false, message: error.message });
      }
      fastify.log.error({ err: error }, 'Erro ao atualizar perfil de aprendizado');
      return reply.status(500).send({
        ok: false,
        message: 'Erro ao atualizar perfil de aprendizado',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
};

export default profileLearningRoutes;


























