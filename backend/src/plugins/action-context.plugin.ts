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

    const rawPath = req.url.split('?')[0];

    // Bootstrap de sessão: listar actors disponíveis sem actor ainda no cliente.
    // Handler usa req.user.id (user_id) — ver social-2.0.routes GET /actors/available.
    if (req.method === 'GET' && rawPath.endsWith('/social/actors/available')) {
      return;
    }

    // Self-scoped: GET /groups/mine deriva sujeito de req.user.userId (JWT server-side).
    // actorId não participa da seleção; exigir actionContext seria contrato falso.
    // DECISION-0113: actorId de cliente = hint, não autoridade. Auth + tenant permanecem obrigatórios.
    if (req.method === 'GET' && rawPath === '/groups/mine') {
      return;
    }

    await actionContextMiddleware(req, reply);
  });
};

export const actionContextPlugin = fp(actionContextPluginImpl, {
  name: 'action-context-plugin',
  dependencies: ['auth-plugin', 'tenant-plugin'],
});







