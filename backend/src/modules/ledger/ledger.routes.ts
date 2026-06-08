// backend/src/modules/ledger/ledger.routes.ts
// Rotas HTTP: leituras passam a usar bank_ledger (SSOT). O economy ledger modular permanece stub para writes legados.

import type { FastifyInstance } from 'fastify';
import type { LedgerEntryFilters } from './ledger.types';
import { bankLedgerRepository } from '../bank/bank-ledger.repository';
import { bankReportingRepository } from '../bank/bank-reporting.repository';
import { BadRequestError } from '@core/errors';
import { ErrorCode } from '@core/errors/error-codes';

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

  // 🔴 DECISION-0113 F6.5.2 (money): gate de AUTORIDADE real (não o `requireLedgerPermission`, que só seta
  // accessLevel e nunca bloqueia). Resolve o DONO REAL da conta da URL e exige representabilidade.
  //   actor-owned (ownerType='user' + actorId) → canRepresentActor(req.user.userId, actorId).
  //   system/escrow / sem actor / inexistente → fail-closed 403 não-leak (gate admin é frente própria:
  //     `DT-LEDGER-ADMIN-READ-GATE-MISSING`). Permissão genérica de ledger NÃO autoriza accountId arbitrário.
  // Retorna true se autorizado; false se já respondeu (401/403) — nesse caso o handler deve `return reply`.
  const assertLedgerAccountAuthority = async (
    req: any,
    reply: any,
    tenantId: string,
    accountId: string
  ): Promise<boolean> => {
    const userId = req.user?.userId as string | undefined;
    if (!userId) {
      reply.status(401).send({ error: 'Não autenticado' });
      return false;
    }
    let account: any = null;
    try {
      const { bankAccountRepository } = await import('../bank/bank-account.repository');
      account = await bankAccountRepository.getAccountById(tenantId, accountId);
    } catch {
      account = null;
    }
    // não-leak: conta inexistente OU não-actor → 403 uniforme (não revela existência nem tipo).
    if (!account || account.ownerType !== 'user' || !account.actorId) {
      reply.status(403).send({ error: 'Conta não acessível por este usuário' });
      return false;
    }
    let canRead = false;
    try {
      const { authorizationService } = await import('@core/authorization/authorization.service');
      canRead = await authorizationService.canRepresentActor(tenantId, userId, account.actorId);
    } catch {
      canRead = false;
    }
    if (!canRead) {
      reply.status(403).send({ error: 'Actor não representável pelo usuário autenticado' });
      return false;
    }
    return true;
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

    // 🔴 DECISION-0113 F6.5.2 (money): leitura por conta → provar DONO REAL (canRepresentActor) ANTES.
    // Sem accountId (list-all do tenant OU só by-contextId) → dinheiro agregado/plataforma → fail-closed 403
    // (gate admin real = frente própria `DT-LEDGER-ADMIN-READ-GATE-MISSING`; `requireLedgerPermission` não conta).
    if (!filters.accountId) {
      return reply
        .status(403)
        .send({ error: 'Listagem agregada/por-contexto exige gate administrativo (indisponível)' });
    }
    if (!(await assertLedgerAccountAuthority(req, reply, tenantId, filters.accountId))) {
      return reply;
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
      rows = await bankReportingRepository.listBankLedgerRowsForExport(tenantId, start, end, limit, undefined);
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

    // 🔴 DECISION-0113 F6.5.2 (OWN-PARAMS, money): o `accountId` vem da URL. Resolver o DONO REAL da conta
    // ANTES de devolver saldo. actor-owned → provar `canRepresentActor(req.user.userId, account.actorId)`.
    // system/escrow / sem actor / inexistente → fail-closed 403 (não-leak; dinheiro de plataforma exige gate
    // admin real — frente própria `DT-LEDGER-ADMIN-READ-GATE-MISSING`; o `requireLedgerPermission` NÃO bloqueia
    // ownership, só seta accessLevel). Permissão genérica de ledger NÃO autoriza ler accountId arbitrário.
    if (!(await assertLedgerAccountAuthority(req, reply, tenantId, req.params.accountId))) return reply;

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
