// src/core/economy/transactions/transaction.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { transactionService } from '../transaction.service';
import {
  transactionIdSchema,
  eventIdSchema,
  accountIdSchema,
  listTransactionsQuerySchema,
} from './transaction.schemas';

/**
 * FINANCIAL READ SURFACE — Estado (2026-05-05)
 * GET /:transactionId     → FUNCIONA via wrapper, que delega para bankTransactionService
 * GET /event/:eventId     → NOT_IMPLEMENTED; retorna 501 antes de qualquer validação
 * GET /account/:accountId → NOT_IMPLEMENTED; retorna 501 antes de qualquer validação
 *
 * dashboard/AI/identity ainda usam getTransactionsByGlobalUserId() → [] via wrapper.
 * Pendente: BankTransactionReadPort. Ver: HIPOTESES_DAS_36_HORAS_2026-05_v3.md #019.FR
 */
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
  fastify.get<{ Params: { eventId: string } }>('/event/:eventId', async (_req, reply) => {
    return reply.status(501).send({
      error: 'NOT_IMPLEMENTED',
      message: 'Consulta por eventId não implementada neste endpoint.',
      hint: 'Mapeamento eventId/referenceId/transactionId pendente de decisão arquitetural.'
    });
  });

  // GET /economy/transactions/account/:accountId - Listar por conta
  fastify.get<{ Params: { accountId: string } }>('/account/:accountId', async (_req, reply) => {
    return reply.status(501).send({
      error: 'NOT_IMPLEMENTED',
      message: 'Listagem por conta não implementada neste endpoint.',
      hint: 'Leitura por conta pendente de BankTransactionReadPort.'
    });
  });
};

export default transactionRoutes;
