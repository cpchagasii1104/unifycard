// backend/src/modules/marketplace/payment-method.routes.ts
// SPRINT 72: Rotas REST para Payment Methods

import type { FastifyInstance } from 'fastify';
import { paymentMethodService } from './payment-method.service';
import type {
  CreatePaymentMethodInput,
  PaymentMethodFilters,
} from './payment-method.types';

const paymentMethodRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /payment-methods
   * Cria método de pagamento
   */
  fastify.post<{ Body: CreatePaymentMethodInput }>('/payment-methods', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    const method = await paymentMethodService.createMethod(
      tenantId,
      req.body,
      actionContext.actorId,
      actionContext.actingUserId
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
      return reply.status(404).send({ error: 'Método não encontrado' });
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
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    const method = await paymentMethodService.getDefaultMethod(tenantId, actorId);
    if (!method) {
      return reply.status(404).send({ error: 'Método default não encontrado' });
    }

    return method;
  });
};

export default paymentMethodRoutes;






