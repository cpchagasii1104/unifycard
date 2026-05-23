// backend/src/modules/ledger/ledger.routes.ts
// Rotas HTTP: leituras passam a usar bank_ledger (SSOT). O economy ledger modular permanece stub para writes legados.

import type { FastifyInstance } from 'fastify';
import type { LedgerEntryFilters } from './ledger.types';
import { bankLedgerRepository } from '../bank/bank-ledger.repository';
import { listBankLedgerRowsForExport } from '../reporting/reporting-bank-aggregates';
import { BadRequestError, ForbiddenError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

type LedgerRequest = { ledgerAccessLevel?: 'full' | 'limited' };

const ledgerRoutes = async (fastify: FastifyInstance) => {
  const requireLedgerPermission = async (req: any, _reply: any) => {
    if (!req.tenant) {
      throw new BadRequestError('Tenant required', ErrorCode.MISSING_TENANT);
    }
    if (!req.actionContext || !req.actionContext.actorId) {
      throw new BadRequestError('ActionContext is required', ErrorCode.VALIDATION_ERROR);
    }

    const tenantId = req.tenant.id;
    const actorId = req.actionContext.actorId;
    const userId = req.user?.id as string | undefined;
    if (!userId) {
      throw new BadRequestError('User required for ledger access', ErrorCode.VALIDATION_ERROR);
    }

    try {
      const { businessAuthorizationService } = await import(
        '@core/authorization/business-authorization.service'
      );

      const hasPermission = await businessAuthorizationService.hasAnyPermission(
        tenantId,
        userId,
        actorId,
        ['financial:view_ledger', 'financial:view_all_ledger']
      );

      if (!hasPermission) {
        req.ledgerAccessLevel = 'limited';
      } else {
        req.ledgerAccessLevel = 'full';
      }
    } catch {
      req.ledgerAccessLevel = 'limited';
    }
  };

  fastify.get<{
    Querystring: {
      accountId?: string;
      contextType?: string;
      contextId?: string;
      entryType?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    };
  }>('/ledger/entries', { preHandler: requireLedgerPermission }, async (req, reply) => {
    if (!req.tenant) {
      throw new BadRequestError('Tenant required', ErrorCode.MISSING_TENANT);
    }
    const tenantId = req.tenant.id;
    const filters: LedgerEntryFilters = {
      accountId: req.query.accountId,
      contextType: req.query.contextType as any,
      contextId: req.query.contextId,
      entryType: req.query.entryType as any,
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    if ((req as LedgerRequest).ledgerAccessLevel === 'limited' && !filters.contextId) {
      throw new ForbiddenError(
        'Limited access: specify contextId to list entries for your context.',
        ErrorCode.PERMISSION_DENIED
      );
    }

    const limit = Math.min(filters.limit ?? 500, 10000);
    const start = filters.startDate;
    const end = filters.endDate;

    let rows: Array<{
      entryId: string;
      accountId: string;
      transactionId: string;
      direction: string;
      amountCents: number;
      createdAt: string;
    }>;

    if (filters.accountId) {
      const bankEntries = await bankLedgerRepository.getEntriesByAccount(tenantId, filters.accountId, {
        startDate: start,
        endDate: end,
        limit,
        offset: req.query.offset ?? 0,
      });
      rows = bankEntries.map((e) => ({
        entryId: e.entryId,
        accountId: e.accountId,
        transactionId: e.transactionId,
        direction: e.entryType,
        amountCents: e.amountCents,
        createdAt: e.createdAt,
      }));
    } else {
      rows = await listBankLedgerRowsForExport(tenantId, start, end, limit, undefined);
    }

    const totalCents = rows.reduce((s, r) => s + r.amountCents, 0);
    return reply.send({ entries: rows, totalCents, source: 'bank_ledger' });
  });

  fastify.get<{
    Params: { accountId: string };
    Querystring: { currency?: string };
  }>('/ledger/accounts/:accountId/balance', { preHandler: requireLedgerPermission }, async (req, reply) => {
    if (!req.tenant) {
      throw new BadRequestError('Tenant required', ErrorCode.MISSING_TENANT);
    }
    const tenantId = req.tenant.id;

    const balance = await bankLedgerRepository.calculateBalance(tenantId, req.params.accountId);

    return reply.send({
      balance: {
        accountId: balance.accountId,
        balanceCents: balance.balanceCents,
        totalCreditsCents: balance.totalCreditsCents,
        totalDebitsCents: balance.totalDebitsCents,
        entryCount: balance.entryCount,
        lastEntryAt: balance.lastEntryAt,
        currency: req.query.currency || 'BRL',
        source: 'bank_ledger',
      },
    });
  });

  fastify.get<{
    Params: { contextType: string; contextId: string };
  }>('/ledger/context/:contextType/:contextId', { preHandler: requireLedgerPermission }, async (_req, reply) => {
    return reply.status(501).send({
      error:
        'Extrato por contextType/contextId não está disponível no bank_ledger; use bank_transactions / reporting.',
      source: 'bank_ledger',
    });
  });
};

export default ledgerRoutes;
