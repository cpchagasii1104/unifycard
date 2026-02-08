// backend/src/modules/services/service-order.routes.ts
// SPRINT 68: Rotas REST para Service Orders

import type { FastifyInstance } from 'fastify';
import { serviceOrderService } from './service-order.service';
import type {
  CreateServiceOrderInput,
  ConfirmServiceOrderInput,
  StartServiceOrderInput,
  CompleteServiceOrderInput,
  CancelServiceOrderInput,
  ServiceOrderFilters,
  ConfirmFinancialTermsInput,
} from './service-order.types';

const serviceOrderRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /service-orders/confirm-booking
   * Confirma booking aceito criando Service Order
   * 
   * REGRAS:
   * - NÃO cria pagamento
   * - NÃO cria comissão
   * - NÃO cria split
   * - Bloqueia agenda explicitamente
   */
  fastify.post<{ Body: { bookingId: string; decisionId: string } }>(
    '/service-orders/confirm-booking',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const actionContext = (req as any).actionContext;

      // ActionContext é obrigatório (V2)
      if (!actionContext || !actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
      }

      const { bookingId, decisionId } = req.body;

      if (!bookingId) {
        return reply.status(400).send({ error: 'bookingId é obrigatório' });
      }

      if (!decisionId) {
        return reply.status(400).send({ error: 'decisionId é obrigatório' });
      }

      try {
        const order = await serviceOrderService.confirmBookingFromDecision(
          tenantId,
          bookingId,
          decisionId,
          actionContext.actorId,
          actionContext.actorId
        );

        return reply.status(201).send(order);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({ 
          error: error.message || 'Erro ao confirmar booking' 
        });
      }
    }
  );

  /**
   * POST /service-orders
   * Cria ordem de serviço (status: DRAFT)
   */
  fastify.post<{ Body: CreateServiceOrderInput }>('/service-orders', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    // ActionContext é obrigatório (V2)
    if (!actionContext || !actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
    }

    // Converter scheduledStart e scheduledEnd de string para Date
    const body = req.body as any;
    if (body.scheduledStart) {
      body.scheduledStart = new Date(body.scheduledStart);
    }
    if (body.scheduledEnd) {
      body.scheduledEnd = new Date(body.scheduledEnd);
    }

    const order = await serviceOrderService.createOrder(
      tenantId,
      body,
          actionContext.actorId,
          actionContext.actorId
    );

    return reply.status(201).send(order);
  });

  /**
   * GET /service-orders
   * Lista ordens de serviço
   */
  fastify.get('/service-orders', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const filters: ServiceOrderFilters = {};
    if (query.serviceId) filters.serviceId = query.serviceId;
    if (query.workerActorId) filters.workerActorId = query.workerActorId;
    if (query.customerActorId) filters.customerActorId = query.customerActorId;
    if (query.status) filters.status = query.status as any;
    if (query.scheduledStartFrom) filters.scheduledStartFrom = new Date(query.scheduledStartFrom);
    if (query.scheduledStartTo) filters.scheduledStartTo = new Date(query.scheduledStartTo);
    if (query.limit) filters.limit = parseInt(query.limit);
    if (query.offset) filters.offset = parseInt(query.offset);

    const orders = await serviceOrderService.listOrders(tenantId, filters);
    return { orders };
  });

  /**
   * GET /service-orders/:id
   * Busca ordem por ID
   */
  fastify.get<{ Params: { id: string } }>('/service-orders/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;

    const order = await serviceOrderService.getOrderById(tenantId, id);
    if (!order) {
      return reply.status(404).send({ error: 'Ordem não encontrada' });
    }

    return order;
  });

  /**
   * POST /service-orders/:id/confirm
   * Confirma ordem de serviço (DRAFT → CONFIRMED)
   */
  fastify.post<{ Params: { id: string }; Body: ConfirmServiceOrderInput }>(
    '/service-orders/:id/confirm',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;
      const actionContext = (req as any).actionContext;

      // ActionContext é obrigatório (V2)
      if (!actionContext || !actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
      }

      const order = await serviceOrderService.confirmOrder(tenantId, id, {
        confirmedByActorId: actionContext.actorId,
        confirmedByUserId: actionContext.actorId,
      });

      return order;
    }
  );

  /**
   * POST /service-orders/:id/start
   * Inicia ordem de serviço (CONFIRMED → IN_PROGRESS)
   */
  fastify.post<{ Params: { id: string }; Body: StartServiceOrderInput }>(
    '/service-orders/:id/start',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;
      const actionContext = (req as any).actionContext;

      // ActionContext é obrigatório (V2)
      if (!actionContext || !actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
      }

      const order = await serviceOrderService.startOrder(tenantId, id, {
        startedByActorId: actionContext.actorId,
        startedByUserId: actionContext.actorId,
        workerNotes: req.body.workerNotes,
      });

      return order;
    }
  );

  /**
   * POST /service-orders/:id/complete
   * Completa ordem de serviço (IN_PROGRESS → COMPLETED)
   */
  fastify.post<{ Params: { id: string }; Body: CompleteServiceOrderInput }>(
    '/service-orders/:id/complete',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;
      const actionContext = (req as any).actionContext;

      // ActionContext é obrigatório (V2)
      if (!actionContext || !actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
      }

      const order = await serviceOrderService.completeOrder(tenantId, id, {
        completedByActorId: actionContext.actorId,
        completedByUserId: actionContext.actorId,
        workerNotes: req.body.workerNotes,
      });

      return order;
    }
  );

  /**
   * POST /service-orders/:id/cancel
   * Cancela ordem de serviço
   */
  fastify.post<{ Params: { id: string }; Body: CancelServiceOrderInput }>(
    '/service-orders/:id/cancel',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;
      const actionContext = (req as any).actionContext;

      // ActionContext é obrigatório (V2)
      if (!actionContext || !actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
      }

      const order = await serviceOrderService.cancelOrder(tenantId, id, {
        cancelledByActorId: actionContext.actorId,
        cancelledByUserId: actionContext.actorId,
        cancellationReason: req.body.cancellationReason,
      });

      return order;
    }
  );

  /**
   * GET /service-orders/:id/financial-terms
   * Visualiza termos financeiros de uma Service Order
   * 
   * REGRAS:
   * - NÃO cria split
   * - NÃO executa pagamento
   * - Apenas retorna valores calculados para visualização
   */
  fastify.get<{ Params: { id: string } }>(
    '/service-orders/:id/financial-terms',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;

      try {
        const terms = await serviceOrderService.getFinancialTerms(tenantId, id);
        return reply.send(terms);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao calcular termos financeiros',
        });
      }
    }
  );

  /**
   * POST /service-orders/:id/confirm-financial-terms
   * Confirma termos financeiros criando split
   * 
   * REGRAS:
   * - NÃO executa pagamento
   * - NÃO move dinheiro automaticamente
   * - Apenas cria entidade de split para rastreabilidade
   * - Confirmação humana obrigatória
   */
  fastify.post<{ Params: { id: string }; Body: ConfirmFinancialTermsInput }>(
    '/service-orders/:id/confirm-financial-terms',
    async (req, reply) => {
      // Feature flag: Financial
      const { isFinancialEnabled } = await import('@core/features/feature-flags');
      if (!isFinancialEnabled()) {
        return reply.status(503).send({
          code: 'FEATURE_DISABLED',
          message: 'Feature de termos financeiros está desabilitada',
        });
      }

      const tenantId = req.tenant!.id;
      const { id } = req.params;
      const actionContext = (req as any).actionContext;

      // ActionContext é obrigatório (V2)
      if (!actionContext || !actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext.actorId é obrigatório' });
      }

      try {
        const result = await serviceOrderService.confirmFinancialTerms(tenantId, id, {
          confirmedByActorId: actionContext.actorId,
          confirmedByUserId: actionContext.actorId,
        });

        return reply.status(201).send(result);
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(error.statusCode || 500).send({
          error: error.message || 'Erro ao confirmar termos financeiros',
        });
      }
    }
  );
};

export default serviceOrderRoutes;




