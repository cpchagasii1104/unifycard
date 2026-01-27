// src/core/economy/ledger/ledger.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { ledgerService } from './ledger.service';
import {
  accountIdSchema,
  transactionIdSchema,
  ledgerQuerySchema,
  summaryQuerySchema,
} from './ledger.schemas';

const ledgerRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /economy/ledger/account/:accountId - Buscar entradas por conta
  fastify.get<{ Params: { accountId: string } }>('/account/:accountId', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const parsedParams = accountIdSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return reply.status(400).send({
        error: 'Invalid account ID',
        details: parsedParams.error.errors,
      });
    }

    const parsedQuery = ledgerQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parsedQuery.error.errors,
      });
    }

    const { limit, offset, startDate, endDate, entryType } = parsedQuery.data;

    const entries = await ledgerService.getLedgerEntries(
      tenantId,
      parsedParams.data.accountId,
      {
        limit,
        offset,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        entryType,
      }
    );

    return { entries };
  });

  // GET /economy/ledger/transaction/:transactionId - Buscar por transação
  fastify.get<{ Params: { transactionId: string } }>('/transaction/:transactionId', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const parsed = transactionIdSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid transaction ID',
        details: parsed.error.errors,
      });
    }

    const entries = await ledgerService.getLedgerEntriesByTransaction(
      tenantId,
      parsed.data.transactionId
    );

    return { entries };
  });

  // GET /economy/ledger/summary/:accountId - Sumário de movimentação
  fastify.get<{ Params: { accountId: string } }>('/summary/:accountId', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const parsedParams = accountIdSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return reply.status(400).send({
        error: 'Invalid account ID',
        details: parsedParams.error.errors,
      });
    }

    const parsedQuery = summaryQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return reply.status(400).send({
        error: 'Invalid query parameters',
        details: parsedQuery.error.errors,
      });
    }

    const { startDate, endDate } = parsedQuery.data;

    const summary = await ledgerService.getAccountSummary(
      tenantId,
      parsedParams.data.accountId,
      {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      }
    );

    return summary;
  });

  // GET /economy/ledger/audit/:accountId - Auditoria de integridade
  fastify.get<{ Params: { accountId: string } }>('/audit/:accountId', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const parsed = accountIdSchema.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid account ID',
        details: parsed.error.errors,
      });
    }

    const accountId = parsed.data.accountId;
    const isValid = await ledgerService.verifyLedgerIntegrity(tenantId, accountId);
    const summary = await ledgerService.getAccountSummary(tenantId, accountId);

    return {
      accountId,
      integrityValid: isValid,
      summary,
    };
  });
};

export default ledgerRoutes;
