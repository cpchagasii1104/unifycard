// src/core/economy/transactions/transaction.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { transactionService } from '../transaction.service';
import {
  transactionIdSchema,
  eventIdSchema,
  accountIdSchema,
  listTransactionsQuerySchema,
} from './transaction.schemas';

const transactionRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /economy/transactions/:transactionId - Buscar por ID
  fastify.get<{ Params: { transactionId: string } }>('/:transactionId', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const parsed = transactionIdSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid transaction ID',
        details: parsed.error.errors,
      });
    }

    const transaction = await transactionService.getTransactionById(
      tenantId,
      parsed.data.transactionId
    );

    if (!transaction) {
      return reply.status(404).send({ error: 'Transaction not found' });
    }

    return transaction;
  });

  // GET /economy/transactions/event/:eventId - Buscar por eventId (idempotência)
  fastify.get<{ Params: { eventId: string } }>('/event/:eventId', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const parsed = eventIdSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid event ID',
        details: parsed.error.errors,
      });
    }

    const transaction = await transactionService.getTransactionByEventId(
      tenantId,
      parsed.data.eventId
    );

    if (!transaction) {
      return reply.status(404).send({ error: 'Transaction not found' });
    }

    return transaction;
  });

  // GET /economy/transactions/account/:accountId - Listar por conta
  fastify.get<{ Params: { accountId: string } }>('/account/:accountId', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const parsedParams = accountIdSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return reply.status(400).send({
        error: 'Invalid account ID',
        details: parsedParams.error.errors,
      });
    }

    const parsedQuery = listTransactionsQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parsedQuery.error.errors,
      });
    }

    const transactions = await transactionService.getTransactionsByAccount(
      tenantId,
      parsedParams.data.accountId,
      parsedQuery.data
    );

    return { transactions };
  });
};

export default transactionRoutes;
