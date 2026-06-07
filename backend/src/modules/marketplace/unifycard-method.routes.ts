// backend/src/modules/marketplace/unifycard-method.routes.ts
// SPRINT 82: Rotas REST para UnifyCard Methods

import type { FastifyInstance } from 'fastify';
import { unifyCardMethodService } from './unifycard-method.service';
import type { CreateUnifyCardMethodInput } from './unifycard-method.types';
import { BadRequestError, NotFoundError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

const unifyCardMethodRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /unifycard/methods
   * Cria método de pagamento UnifyCard
   */
  // 🔴 DECISION-0113 fatia 3 (F3.1): criar método/config de adquirência (fees/settlement_days) é
  // ação tenant/admin-level. Gate admin canônico (rbac.plugin já binda req.user via canRepresentActor
  // na fatia 1) — usuário comum não configura adquirência. `actionContext.actorId` deixa de ser autoridade.
  fastify.post<{ Body: CreateUnifyCardMethodInput }>(
    '/unifycard/methods',
    { preHandler: [fastify.requireRole(['admin'])] },
    async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
    }

    const method = await unifyCardMethodService.createMethod(
      tenantId,
      req.body,
      actionContext.actorId
    );

    return reply.status(201).send(method);
  });

  /**
   * GET /unifycard/methods
   * Lista métodos UnifyCard
   */
  fastify.get('/unifycard/methods', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const methods = await unifyCardMethodService.listMethods(tenantId);

    return reply.send({ methods, totalCents: methods.length });
  });

  /**
   * GET /unifycard/methods/:type
   * Busca método por tipo
   */
  fastify.get<{ Params: { type: string } }>('/unifycard/methods/:type', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const method = await unifyCardMethodService.getMethodByType(tenantId, req.params.type);

    if (!method) {
      throw new NotFoundError('Método não encontrado');
    }

    return reply.send(method);
  });
};

export default unifyCardMethodRoutes;
