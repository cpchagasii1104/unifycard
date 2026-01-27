// backend/src/modules/marketplace/accounts-payable.routes.ts
// SPRINT 70: Rotas REST para Accounts Payable

import type { FastifyInstance } from 'fastify';
import { accountsPayableService } from './accounts-payable.service';
import type {
  CreateFromPurchaseOrderInput,
  CreateManualPayableInput,
  SchedulePaymentInput,
  AccountsPayableFilters,
} from './accounts-payable.types';

const accountsPayableRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /accounts-payable/from-purchase-order
   * Cria conta a pagar a partir de Purchase Order
   */
  fastify.post<{ Body: CreateFromPurchaseOrderInput }>(
    '/accounts-payable/from-purchase-order',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const actionContext = (req as any).actionContext;

      if (!actionContext?.actingActorId) {
        return reply.status(400).send({ error: 'actingActorId é obrigatório' });
      }

      // Converter dueDate se necessário
      const body = req.body as any;
      if (body.dueDate) {
        body.dueDate = new Date(body.dueDate);
      }

      const payable = await accountsPayableService.createFromPurchaseOrder(
        tenantId,
        body,
        actionContext.actingActorId,
        actionContext.actingUserId
      );

      return reply.status(201).send(payable);
    }
  );

  /**
   * POST /accounts-payable/manual
   * Cria conta a pagar manual
   */
  fastify.post<{ Body: CreateManualPayableInput }>('/accounts-payable/manual', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actingActorId) {
      return reply.status(400).send({ error: 'actingActorId é obrigatório' });
    }

    // Converter dueDate se necessário
    const body = req.body as any;
    if (body.dueDate) {
      body.dueDate = new Date(body.dueDate);
    }

    const payable = await accountsPayableService.createManualPayable(
      tenantId,
      body,
      actionContext.actingActorId,
      actionContext.actingUserId
    );

    return reply.status(201).send(payable);
  });

  /**
   * GET /accounts-payable
   * Lista contas a pagar
   */
  fastify.get('/accounts-payable', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const filters: AccountsPayableFilters = {};
    if (query.supplierId) filters.supplierId = query.supplierId;
    if (query.status) filters.status = query.status as any;
    if (query.referenceType) filters.referenceType = query.referenceType as any;
    if (query.referenceId) filters.referenceId = query.referenceId;
    if (query.dueDateFrom) filters.dueDateFrom = query.dueDateFrom;
    if (query.dueDateTo) filters.dueDateTo = query.dueDateTo;
    if (query.limit) filters.limit = parseInt(query.limit);
    if (query.offset) filters.offset = parseInt(query.offset);

    const payables = await accountsPayableService.listPayables(tenantId, filters);
    return { payables };
  });

  /**
   * GET /accounts-payable/:id
   * Busca conta por ID
   */
  fastify.get<{ Params: { id: string } }>('/accounts-payable/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;

    const payable = await accountsPayableService.getPayableById(tenantId, id);
    if (!payable) {
      return reply.status(404).send({ error: 'Conta não encontrada' });
    }

    return payable;
  });

  /**
   * POST /accounts-payable/:id/schedule
   * Agenda pagamento (cria scheduled_action)
   */
  fastify.post<{ Params: { id: string }; Body: SchedulePaymentInput }>(
    '/accounts-payable/:id/schedule',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;
      const actionContext = (req as any).actionContext;

      if (!actionContext?.actingActorId) {
        return reply.status(400).send({ error: 'actingActorId é obrigatório' });
      }

      // Converter scheduledFor se necessário
      const body = req.body as any;
      if (body.scheduledFor) {
        body.scheduledFor = new Date(body.scheduledFor);
      }

      const payable = await accountsPayableService.schedulePayment(
        tenantId,
        id,
        body,
        actionContext.actingActorId,
        actionContext.actingUserId
      );

      return payable;
    }
  );

  /**
   * POST /accounts-payable/:id/mark-paid
   * Marca conta como paga
   */
  fastify.post<{ Params: { id: string } }>('/accounts-payable/:id/mark-paid', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actingActorId) {
      return reply.status(400).send({ error: 'actingActorId é obrigatório' });
    }

    const payable = await accountsPayableService.markAsPaid(
      tenantId,
      id,
      actionContext.actingActorId,
      actionContext.actingUserId
    );

    return payable;
  });

  /**
   * POST /accounts-payable/:id/cancel
   * Cancela conta a pagar
   */
  fastify.post<{ Params: { id: string }; Body: { cancellationReason?: string } }>(
    '/accounts-payable/:id/cancel',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;
      const actionContext = (req as any).actionContext;

      if (!actionContext?.actingActorId) {
        return reply.status(400).send({ error: 'actingActorId é obrigatório' });
      }

      const payable = await accountsPayableService.cancelPayable(
        tenantId,
        id,
        actionContext.actingActorId,
        actionContext.actingUserId,
        req.body.cancellationReason
      );

      return payable;
    }
  );
};

export default accountsPayableRoutes;






