// backend/src/plugins/action-context.plugin.ts
// CONTINUOUS PRODUCTION: Action Context Plugin
// Obriga action_context em endpoints mutáveis

import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { actionContextMiddleware } from '@core/action-context/action-context.middleware';

const actionContextPluginImpl: FastifyPluginAsync = async (fastify) => {
  // Aplicar middleware apenas em rotas protegidas (que já têm auth)
  fastify.addHook('preHandler', async (req, reply) => {
    // Apenas aplicar se já passou pelo auth plugin
    if (!req.user || !req.tenant) {
      return; // Deixar auth plugin tratar
    }

    // Bootstrap de sessão: listar actors disponíveis sem actor ainda no cliente.
    // Handler usa req.user.id (user_id) — ver social-2.0.routes GET /actors/available.
    const rawPath = req.url.split('?')[0];
    if (req.method === 'GET' && rawPath.endsWith('/social/actors/available')) {
      return;
    }

    await actionContextMiddleware(req, reply);
  });
};

export const actionContextPlugin = fp(actionContextPluginImpl, {
  name: 'action-context-plugin',
  dependencies: ['auth-plugin', 'tenant-plugin'],
});







