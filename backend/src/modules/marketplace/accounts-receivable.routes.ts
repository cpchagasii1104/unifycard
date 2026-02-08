// backend/src/modules/marketplace/accounts-receivable.routes.ts
// SPRINT 71: Rotas REST para Accounts Receivable

import type { FastifyInstance } from 'fastify';
import { accountsReceivableService } from './accounts-receivable.service';
import type {
  CreateManualReceivableInput,
  AccountsReceivableFilters,
} from './accounts-receivable.types';

const accountsReceivableRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /accounts-receivable/manual
   * Cria conta a receber manual
   */
  fastify.post<{ Body: CreateManualReceivableInput }>('/accounts-receivable/manual', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    // Converter expectedAt se necessário
    const body = req.body as any;
    if (body.expectedAt) {
      body.expectedAt = new Date(body.expectedAt);
    }

    const receivable = await accountsReceivableService.createManualReceivable(
      tenantId,
      body,
      actionContext.actorId,
      actionContext.actingUserId
    );

    return reply.status(201).send(receivable);
  });

  /**
   * GET /accounts-receivable
   * Lista contas a receber
   */
  fastify.get('/accounts-receivable', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const filters: AccountsReceivableFilters = {};
    if (query.actorId) filters.actorId = query.actorId;
    if (query.status) filters.status = query.status as any;
    if (query.sourceType) filters.sourceType = query.sourceType as any;
    if (query.sourceId) filters.sourceId = query.sourceId;
    if (query.expectedAtFrom) filters.expectedAtFrom = query.expectedAtFrom;
    if (query.expectedAtTo) filters.expectedAtTo = query.expectedAtTo;
    if (query.limit) filters.limit = parseInt(query.limit);
    if (query.offset) filters.offset = parseInt(query.offset);

    const receivables = await accountsReceivableService.listReceivables(tenantId, filters);
    return { receivables };
  });

  /**
   * GET /accounts-receivable/:id
   * Busca conta por ID
   */
  fastify.get<{ Params: { id: string } }>('/accounts-receivable/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;

    const receivable = await accountsReceivableService.getReceivableById(tenantId, id);
    if (!receivable) {
      return reply.status(404).send({ error: 'Conta não encontrada' });
    }

    return receivable;
  });

  /**
   * POST /accounts-receivable/:id/mark-received
   * Marca conta como recebida
   */
  fastify.post<{ Params: { id: string } }>('/accounts-receivable/:id/mark-received', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    const receivable = await accountsReceivableService.markAsReceived(
      tenantId,
      id,
      actionContext.actorId,
      actionContext.actingUserId
    );

    return receivable;
  });

  /**
   * POST /accounts-receivable/:id/cancel
   * Cancela conta a receber
   */
  fastify.post<{ Params: { id: string }; Body: { cancellationReason?: string } }>(
    '/accounts-receivable/:id/cancel',
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { id } = req.params;
      const actionContext = (req as any).actionContext;

      if (!actionContext?.actorId) {
        return reply.status(400).send({ error: 'actorId é obrigatório' });
      }

      const receivable = await accountsReceivableService.cancelReceivable(
        tenantId,
        id,
        actionContext.actorId,
        actionContext.actingUserId,
        req.body.cancellationReason
      );

      return receivable;
    }
  );
};

export default accountsReceivableRoutes;






