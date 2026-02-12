// backend/src/modules/marketplace/unifycard-method.routes.ts
// SPRINT 82: Rotas REST para UnifyCard Methods

import type { FastifyInstance } from 'fastify';
import { unifyCardMethodService } from './unifycard-method.service';
import type { CreateUnifyCardMethodInput } from './unifycard-method.types';

const unifyCardMethodRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /unifycard/methods
   * Cria método de pagamento UnifyCard
   */
  fastify.post<{ Body: CreateUnifyCardMethodInput }>('/unifycard/methods', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
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
      return reply.status(404).send({ error: 'Método não encontrado' });
    }

    return reply.send(method);
  });
};

export default unifyCardMethodRoutes;






