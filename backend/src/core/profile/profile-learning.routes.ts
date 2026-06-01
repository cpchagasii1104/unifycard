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
   * PUT /profile/learning — LEGADO (501 Not Implemented)
   * Aprendizado foi migrado e provado em C1 actor-first (DECISION-0067, Fatia 4b).
   * A escrita agora é o contrato granular /profile/learning/c1/* (POST/PATCH/DELETE).
   * Esta rota NÃO grava mais em global_users.metadata (Fatia 5 — cleanup do blob); responde 501 explícito.
   */
  fastify.put('/learning', async (_req, reply) => {
    return reply.status(501).send({
      ok: false,
      message: 'Endpoint legado migrado para /profile/learning/c1.',
      replacement: '/profile/learning/c1',
    });
  });
};

export default profileLearningRoutes;


























