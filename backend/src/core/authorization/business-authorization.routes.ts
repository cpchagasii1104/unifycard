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

    // 🔴 R8L canal-1 BIND (DECISION-0113 / Z2): leitura sensível de permissão/role. O SUBJECT da checagem é o
    // utilizador AUTENTICADO (req.user, server-side) — NUNCA o actionContext.actorId client-declared (antes ele
    // governava o operador, permitindo perguntar "o operador X pode A em Y?" sem provar ser X). `req.query.actorId`
    // é apenas o CONTEXTO organizacional (alvo) sobre o qual o caller pergunta a SUA PRÓPRIA permissão:
    // checkPermission → getUserRole(tenantId, req.user, orgActorId) resolve o papel REAL do caller naquela org,
    // revelando só o que é dele. Subject server-side; alvo = filtro de leitura. Recognizer: safeSubjectProof Forma B
    // (subject=req.user, subj!=target). Guard: audit-business-authorization-read-authority.mjs.
    const subjectUserId = req.user?.id;
    if (!subjectUserId) {
      return reply
        .status(401)
        .send({ error: 'BUSINESS_AUTHORIZATION_ACTOR_AUTHORITY_REQUIRED', message: 'Não autenticado: subject server-side obrigatório' });
    }

    const { action, contextId } = req.query;
    const orgActorId = req.query.actorId; // contexto organizacional (alvo de leitura), NÃO subject

    if (!action || !orgActorId) {
      return reply.status(400).send({ error: 'action e actorId são obrigatórios' });
    }

    try {
      const result = await businessAuthorizationService.checkPermission(
        tenantId,
        subjectUserId,
        orgActorId,
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




