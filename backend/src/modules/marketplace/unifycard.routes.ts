// backend/src/modules/marketplace/unifycard.routes.ts
// SPRINT 73: Rotas REST para UnifyCard Acquiring

import type { FastifyInstance } from 'fastify';
import { unifyCardService } from './unifycard.service';
import type {
  AuthorizeTransactionInput,
  CaptureTransactionInput,
  SettleTransactionInput,
  UnifyCardTransactionFilters,
} from './unifycard.types';
import { BadRequestError, NotFoundError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

const unifyCardRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /unifycard/authorize
   * Autoriza transação UnifyCard
   */
  fastify.post<{ Body: AuthorizeTransactionInput }>('/unifycard/authorize', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
    }

    const actorId = actionContext.actorId;

    const transaction = await unifyCardService.authorize(
      tenantId,
      req.body,
      actorId,
      actionContext.actorId,
      actionContext.actorId
    );

    return reply.status(201).send(transaction);
  });

  /**
   * POST /unifycard/capture
   * Captura transação UnifyCard
   */
  fastify.post<{ Body: CaptureTransactionInput }>('/unifycard/capture', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
    }

    const transaction = await unifyCardService.capture(
      tenantId,
      req.body,
      actionContext.actorId,
      actionContext.actorId
    );

    return transaction;
  });

  /**
   * POST /unifycard/settle
   * Liquida transação UnifyCard
   */
  fastify.post<{ Body: SettleTransactionInput }>('/unifycard/settle', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      throw new BadRequestError('actorId é obrigatório', ErrorCode.MISSING_ACTOR);
    }

    const transaction = await unifyCardService.settle(
      tenantId,
      req.body,
      actionContext.actorId,
      actionContext.actorId
    );

    return transaction;
  });

  /**
   * GET /unifycard/transactions
   * Lista transações UnifyCard
   */
  fastify.get('/unifycard/transactions', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const query = req.query as any;

    const filters: UnifyCardTransactionFilters = {};
    if (query.actorId) filters.actorId = query.actorId;
    if (query.status) filters.status = query.status as any;
    if (query.transactionType) filters.transactionType = query.transactionType as any;
    if (query.paymentIntentId) filters.paymentIntentId = query.paymentIntentId;
    if (query.limit) filters.limit = parseInt(query.limit);
    if (query.offset) filters.offset = parseInt(query.offset);

    const transactions = await unifyCardService.listTransactions(tenantId, filters);
    return { transactions };
  });

  /**
   * GET /unifycard/transactions/:id
   * Busca transação por ID
   */
  fastify.get<{ Params: { id: string } }>('/unifycard/transactions/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { id } = req.params;

    const transaction = await unifyCardService.getTransactionById(tenantId, id);
    if (!transaction) {
      throw new NotFoundError('Transação não encontrada');
    }

    return transaction;
  });
};

export default unifyCardRoutes;
