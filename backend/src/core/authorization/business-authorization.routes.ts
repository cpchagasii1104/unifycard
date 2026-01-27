// backend/src/core/authorization/business-authorization.routes.ts
// Rotas para verificação de permissões (apenas para UI)
// 🔴 BLINDAGEM: Backend sempre valida novamente nas ações críticas

import { FastifyPluginAsync } from 'fastify';
import { businessAuthorizationService } from './business-authorization.service';
import type { BusinessAction } from './business-permissions.types';

const businessAuthorizationRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /business-permissions/check
   * Verificar permissão (apenas para UI - backend sempre valida novamente)
   */
  fastify.get<{
    Querystring: {
      action: string;
      actorId: string;
      contextId?: string;
    };
  }>('/business-permissions/check', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actingUserId) {
      return reply.status(400).send({ error: 'actingUserId é obrigatório' });
    }

    const { action, actorId, contextId } = req.query;

    if (!action || !actorId) {
      return reply.status(400).send({ error: 'action e actorId são obrigatórios' });
    }

    try {
      const result = await businessAuthorizationService.checkPermission(
        tenantId,
        actionContext.actingUserId,
        actorId,
        action as BusinessAction,
        contextId
      );
      return result;
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao verificar permissão');
      return reply.status(error.statusCode || 500).send({
        error: 'Erro ao verificar permissão',
        message: error.message,
      });
    }
  });
};

export default businessAuthorizationRoutes;




