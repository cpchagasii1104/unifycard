// src/core/profile/profile-learning.routes.ts
// Rotas LEGADAS de perfil de aprendizado — MIGRADAS para /profile/learning/c1 (DECISION-0067).
// GET e PUT respondem 501 explícito. A leitura é GET /profile/learning/c1; a escrita é o contrato granular
// /profile/learning/c1/* (POST/PATCH/DELETE). Os readers backend já leem o C1 (DECISION-0069, F2–F4); o
// serviço legado getLearningProfile não é mais chamado por estas rotas. Não grava/lê global_users.metadata.

import { FastifyPluginAsync } from 'fastify';

const profileLearningRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /profile/learning — LEGADO (501 Not Implemented)
   * Migrado para GET /profile/learning/c1. NÃO chama o serviço legado (que lia o blob hoje vazio).
   */
  fastify.get('/learning', async (_req, reply) => {
    return reply.status(501).send({
      ok: false,
      code: 'PROFILE_LEARNING_LEGACY_DISABLED',
      message: 'Use /profile/learning/c1',
      replacement: '/profile/learning/c1',
    });
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


























