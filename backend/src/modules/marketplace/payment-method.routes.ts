// backend/src/modules/marketplace/payment-method.routes.ts
// SPRINT 72: Rotas REST para Payment Methods

import type { FastifyInstance } from 'fastify';
import { paymentMethodService } from './payment-method.service';
import { authorizationService } from '@core/authorization/authorization.service';
import type {
  CreatePaymentMethodInput,
  PaymentMethodFilters,
} from './payment-method.types';
import { BadRequestError, NotFoundError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

const paymentMethodRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /payment-methods
   * Cria método de pagamento
   */
  fastify.post<{ Body: CreatePaymentMethodInput }>('/payment-methods', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
    }

    // 🔴 DECISION-0113 fatia 3 (F3.1): o dono do método é `input.actorId` (body). Provar que o
    // usuário autenticado PODE representar esse actor ANTES do insert e do unsetDefaultForActor
    // (que mutaria o default de outro actor). `actionContext.actorId` é hint, não autoridade.
    const userId = (req as { user?: { id?: string } }).user?.id;
    if (!userId) {
      return reply.status(401).send({ error: 'Autenticação obrigatória (req.user.id) para criar método de pagamento' });
    }
    const ownerActorId = req.body?.actorId;
    if (!ownerActorId) {
      throw new BadRequestError('actorId (dono do método) é obrigatório', ErrorCode.MISSING_ACTOR);
    }
    let canOwn = false;
    try {
      canOwn = await authorizationService.canRepresentActor(tenantId, userId, ownerActorId);
    } catch {
      canOwn = false;
    }
    if (!canOwn) {
      return reply.status(403).send({
        error: 'Você não pode criar método de pagamento para este actor (DECISION-0113)',
        code: 'PAYMENT_METHOD_ACTOR_NOT_REPRESENTABLE',
      });
    }

    // Autoria server-side: createdBy = actor provado (dono) + principal autenticado, nunca o actorId cru.
    const method = await paymentMethodService.createMethod(
      tenantId,
      req.body,
      ownerActorId,
      userId
    );

    return reply.status(201).send(method);
  });

  /**
   * GET /payment-methods
   * Lista métodos de pagamento
   */
  fastify.get('/payment-methods', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const filters: PaymentMethodFilters = {};
    if (query.actorId) filters.actorId = query.actorId;
    if (query.type) filters.type = query.type as any;
    if (query.provider) filters.provider = query.provider as any;
    if (query.isDefault !== undefined) filters.isDefault = query.isDefault === 'true';
    if (query.limit) filters.limit = parseInt(query.limit);
    if (query.offset) filters.offset = parseInt(query.offset);

    const methods = await paymentMethodService.listMethods(tenantId, filters);
    return { methods };
  });

  /**
   * GET /payment-methods/:id
   * Busca método por ID
   */
  fastify.get<{ Params: { id: string } }>('/payment-methods/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;

    const method = await paymentMethodService.getMethodById(tenantId, id);
    if (!method) {
      throw new NotFoundError('Método não encontrado');
    }

    return method;
  });

  /**
   * GET /payment-methods/default
   * Busca método default do actor
   */
  fastify.get<{ Querystring: { actorId: string } }>('/payment-methods/default', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { actorId } = req.query;

    if (!actorId) {
      throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
    }

    const method = await paymentMethodService.getDefaultMethod(tenantId, actorId);
    if (!method) {
      throw new NotFoundError('Método default não encontrado');
    }

    return method;
  });
};

export default paymentMethodRoutes;