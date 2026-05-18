// backend/src/core/unifybank/bank-http.routes.ts
// Exposição HTTP do Bank (§4.7): contratos BankHttp* + parse na fronteira.
// Domínio: @modules/bank — aqui só orquestração, authorship e erros canónicos.

import { randomUUID } from 'crypto';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { buildCanonicalHttpErrorPayload } from '@core/http/canonical-http-error';
import { bankPortsRegistry } from '@core/bank/ports-registry';
import { resolveGlobalUserId } from '@core/identity/identity.utils';
import { parsePositiveMoneyToCents } from '@modules/bank/bank-http-money';
import { buildFinancialAuthorshipFromRequest } from '@modules/bank/financial-authorship.helper';
import { ensureUserActor } from '@modules/identity/actor-writer.service';
import { bankAccountService } from '@modules/bank/bank-account.service';
import type { BankTransactionContext } from '@modules/bank/bank-split.types';
import type { BankCurrency } from '@modules/bank/bank-account.types';

function bankHttpReqId(req: FastifyRequest): string {
  const h = req.headers['x-request-id'];
  if (typeof h === 'string' && h.trim()) {
    return h.trim();
  }
  const raw = (req as { requestId?: string; id?: string }).requestId ?? req.id;
  return typeof raw === 'string' && raw.trim() !== '' ? raw : randomUUID();
}

function sendBankError(
  reply: FastifyReply,
  req: FastifyRequest,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  const requestId = bankHttpReqId(req);
  reply.header('x-request-id', requestId);
  return reply.status(statusCode).send(
    buildCanonicalHttpErrorPayload(
      code,
      message,
      requestId,
      details && Object.keys(details).length > 0 ? { details } : undefined
    )
  );
}

function setBankSuccessHeaders(reply: FastifyReply, req: FastifyRequest) {
  const requestId = bankHttpReqId(req);
  reply.header('x-request-id', requestId);
}

async function assertUserOwnsFromAccount(
  tenantId: string,
  userId: string,
  fromAccountId: string
): Promise<void> {
  const account = await bankAccountService.getAccountById(tenantId, fromAccountId);
  if (!account) {
    const e = new Error('From account not found') as Error & { statusCode?: number };
    e.statusCode = 404;
    throw e;
  }
  if (account.ownerType !== 'user' || account.ownerId !== userId) {
    const e = new Error('Forbidden: fromAccountId must belong to the authenticated user') as Error & {
      statusCode?: number;
    };
    e.statusCode = 403;
    throw e;
  }
}

const bankTransactionTypeSchema = z.enum([
  'transfer',
  'deposit',
  'withdrawal',
  'reversal',
  'fee',
  'split',
  'escrow',
  'release',
]);

const bankTransactionContextSchema = z.enum([
  'service_booking',
  'event_ticket',
  'p2p_transfer',
  'group_contribution',
  'ride_payment',
  'deposit',
  'withdrawal',
]);

const bankCurrencySchema = z.enum(['BRL', 'USD', 'EUR', 'TEST']);

const simpleTransactionBodySchema = z.object({
  eventId: z.string().min(1).max(256),
  referenceType: z.string().min(1).max(128),
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amountCents: z.union([z.number(), z.string()]),
  currency: bankCurrencySchema.optional(),
  transactionType: bankTransactionTypeSchema,
  description: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const splitTransactionBodySchema = z.object({
  eventId: z.string().min(1).max(256),
  fromAccountId: z.string().uuid(),
  amountCents: z.union([z.number(), z.string()]),
  currency: bankCurrencySchema.optional(),
  context: bankTransactionContextSchema,
  revenueShareAccountId: z.string().uuid().optional(),
  description: z.string().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const bankHttpRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /bank/balance
   * Saldo do utilizador autenticado (centavos inteiros — §4.7).
   *
   * 2026-05-18 P1 — aceita ?actorId= opcional para resolver saldo por actor.
   * Quando actorId presente: valida authority via actorCapabilitiesService
   * (mesma cadeia de SSOT: actors + company_users + actor_delegations) e
   * resolve saldo do actor (user/page/group). Sem actorId: comportamento
   * legado (saldo do user autenticado).
   * Fecha DT-PRESSURE-BANK-ACTOR-CONTEXT.
   */
  fastify.get<{ Querystring: { actorId?: string } }>('/balance', async (req, reply) => {
    const requestId = bankHttpReqId(req);
    reply.header('x-request-id', requestId);
    req.log.info({ requestId, route: 'GET /bank/balance', actorId: req.query.actorId }, 'bank.http.balance');

    if (!req.user?.id) {
      return reply.status(200).send({
        success: true,
        balanceCents: 0,
        balance: 0,
        currency: 'BRL',
        hasAccount: false,
      });
    }

    if (!req.tenant?.id) {
      return reply.status(200).send({
        success: true,
        balanceCents: 0,
        balance: 0,
        currency: 'BRL',
        hasAccount: false,
      });
    }

    const tenantId = req.tenant.id;
    const userId = req.user.id;
    const actorIdParam = req.query.actorId;

    const globalUserId = await resolveGlobalUserId(userId, tenantId);
    if (!globalUserId) {
      return reply.status(200).send({
        success: true,
        balanceCents: 0,
        balance: 0,
        currency: 'BRL',
        hasAccount: false,
      });
    }

    try {
      const bankIntegration = bankPortsRegistry.getBankIntegration();

      // Caminho legado: sem actorId → saldo do user
      if (!actorIdParam) {
        const balanceCents = await bankIntegration.getUserBalance(tenantId, userId, 'BRL');
        return reply.status(200).send({
          success: true,
          balanceCents,
          balance: balanceCents,
          currency: 'BRL',
          hasAccount: true,
        });
      }

      // Caminho novo: valida authority via capability resolver e resolve por actor.
      // actorCapabilitiesService retorna null se user sem authority sobre actor.
      const { actorCapabilitiesService } = await import('@core/actor-capabilities/actor-capabilities.service');
      const caps = await actorCapabilitiesService.resolveForUser(tenantId, actorIdParam, userId);
      if (!caps) {
        return sendBankError(reply, req, 403, 'FORBIDDEN', 'User has no authority over this actor');
      }
      // Verifica capability mínima (bank.view_balance — base de user; company.view_reports — page com permissão; sempre presente para owner/director)
      const allowed = caps.capabilities.includes('bank.view_balance') || caps.capabilities.includes('company.view_reports') || caps.capabilities.includes('company.manage_financial') || caps.capabilities.includes('company.manage_company');
      if (!allowed) {
        return sendBankError(reply, req, 403, 'FORBIDDEN', 'Authority over actor present but no capability to view balance');
      }
      // hasAccount reflete realidade material: getActorBalance resolve actor → conta;
      // se conta não existe, retorna 0 e hasAccount=false. Quando conta existe mas
      // saldo é zero, hasAccount=true. Sem fake success.
      const balanceCents = await bankIntegration.getActorBalance(tenantId, actorIdParam, 'BRL');
      const accountResolved = await (async () => {
        // Re-resolve para distinguir "actor sem conta" de "conta com saldo zero"
        const { bankAccountService } = await import('@modules/bank/bank-account.service');
        const { runQueryWithTenant } = await import('@core/database/pool');
        const actorRow = await runQueryWithTenant<{ actor_type: string; user_id: string | null; company_id: string | null; group_id: string | null }>(
          tenantId,
          `SELECT actor_type, user_id, company_id, group_id FROM actors WHERE tenant_id = $1 AND actor_id = $2 LIMIT 1`,
          [tenantId, actorIdParam]
        );
        if (!actorRow) return false;
        if (actorRow.actor_type === 'user' && actorRow.user_id) {
          return !!(await bankAccountService.getAccountByOwner(tenantId, actorRow.user_id, 'user', 'BRL'));
        }
        if (actorRow.actor_type === 'page' && actorRow.company_id) {
          return !!(await bankAccountService.getAccountByOwner(tenantId, actorRow.company_id, 'company', 'BRL'));
        }
        if (actorRow.actor_type === 'group' && actorRow.group_id) {
          return !!(await bankAccountService.getAccountByOwner(tenantId, actorRow.group_id, 'company', 'BRL'));
        }
        return false;
      })();
      return reply.status(200).send({
        success: true,
        balanceCents,
        balance: balanceCents,
        currency: 'BRL',
        hasAccount: accountResolved,
      });
    } catch (err) {
      req.log.error({ err, requestId, userId, tenantId, actorId: actorIdParam }, 'bank.http.balance.error');
      return reply.status(200).send({
        success: true,
        balanceCents: 0,
        balance: 0,
        currency: 'BRL',
        hasAccount: false,
      });
    }
  });

  /**
   * POST /bank/transactions/simple
   * Transação simples (double-entry); fromAccountId tem de ser carteira do utilizador.
   */
  fastify.post('/transactions/simple', async (req, reply) => {
    setBankSuccessHeaders(reply, req);
    const requestId = bankHttpReqId(req);
    req.log.info({ requestId, route: 'POST /bank/transactions/simple' }, 'bank.http.simple');

    if (!req.user?.id) {
      return sendBankError(reply, req, 401, 'UNAUTHORIZED', 'Authentication required');
    }
    if (!req.tenant?.id) {
      return sendBankError(reply, req, 400, 'TENANT_REQUIRED', 'Tenant context required');
    }

    const parsed = simpleTransactionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return sendBankError(reply, req, 400, 'VALIDATION_ERROR', 'Invalid request body', {
        issues: parsed.error.flatten(),
      });
    }

    const tenantId = req.tenant.id;
    const userId = req.user.id;
    const body = parsed.data;

    let amountCents: number;
    try {
      amountCents = parsePositiveMoneyToCents(body.amountCents, 'body.amountCents');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return sendBankError(reply, req, 400, 'INVALID_AMOUNT_CENTS', msg);
    }

    try {
      await assertUserOwnsFromAccount(tenantId, userId, body.fromAccountId);
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      const code = err.statusCode === 403 ? 'FORBIDDEN' : 'NOT_FOUND';
      return sendBankError(reply, req, err.statusCode ?? 500, code, err.message);
    }

    const actor = await ensureUserActor(tenantId, userId);
    const authorship = buildFinancialAuthorshipFromRequest({
      performedByUserId: userId,
      actingForActorId: actor.actor_id,
      actingForAccountId: body.fromAccountId,
      authoritySource: 'ownership',
      permissionSnapshot: {
        permissionKey: 'ownership',
        allowed: true,
        actorId: actor.actor_id,
        userId,
        decidedAt: new Date().toISOString(),
      },
    });

    const currency = (body.currency ?? 'BRL') as BankCurrency;

    try {
      const bankTransaction = bankPortsRegistry.getBankTransaction();
      const result = await bankTransaction.createSimpleTransaction(tenantId, {
        eventId: body.eventId,
        referenceType: body.referenceType,
        fromAccountId: body.fromAccountId,
        toAccountId: body.toAccountId,
        amountCents,
        currency,
        transactionType: body.transactionType,
        description: body.description,
        metadata: body.metadata as Record<string, unknown> | undefined,
        authorship,
      });

      const t = result.transaction;
      return reply.status(200).send({
        success: true,
        transaction: {
          transactionId: t.transactionId,
          eventId: t.eventId,
          amountCents: t.amountCents,
          currency: t.currency,
          transactionType: t.transactionType,
          fromAccountId: t.fromAccountId ?? null,
          toAccountId: t.toAccountId ?? null,
          status: t.status,
          createdAt: t.createdAt,
        },
        ledgerEntries: result.ledgerEntries,
      });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      req.log.error({ err: error, requestId, tenantId, userId }, 'bank.http.simple.error');
      const status = err.statusCode ?? 500;
      const code =
        status === 400
          ? 'BAD_REQUEST'
          : status === 403
            ? 'FORBIDDEN'
            : status === 404
              ? 'NOT_FOUND'
              : status === 409
                ? 'CONFLICT'
                : 'INTERNAL_ERROR';
      return sendBankError(reply, req, status, code, err.message || 'Transaction failed');
    }
  });

  /**
   * POST /bank/transactions/split
   * Transação com split automático; fromAccountId = carteira do utilizador.
   * revenueShareAccountId: contraparte principal quando o contexto exige (ex.: P2P → conta destino).
   */
  fastify.post('/transactions/split', async (req, reply) => {
    setBankSuccessHeaders(reply, req);
    const requestId = bankHttpReqId(req);
    req.log.info({ requestId, route: 'POST /bank/transactions/split' }, 'bank.http.split');

    if (!req.user?.id) {
      return sendBankError(reply, req, 401, 'UNAUTHORIZED', 'Authentication required');
    }
    if (!req.tenant?.id) {
      return sendBankError(reply, req, 400, 'TENANT_REQUIRED', 'Tenant context required');
    }

    const parsed = splitTransactionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return sendBankError(reply, req, 400, 'VALIDATION_ERROR', 'Invalid request body', {
        issues: parsed.error.flatten(),
      });
    }

    const tenantId = req.tenant.id;
    const userId = req.user.id;
    const body = parsed.data;

    let amountCents: number;
    try {
      amountCents = parsePositiveMoneyToCents(body.amountCents, 'body.amountCents');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return sendBankError(reply, req, 400, 'INVALID_AMOUNT_CENTS', msg);
    }

    try {
      await assertUserOwnsFromAccount(tenantId, userId, body.fromAccountId);
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      const code = err.statusCode === 403 ? 'FORBIDDEN' : 'NOT_FOUND';
      return sendBankError(reply, req, err.statusCode ?? 500, code, err.message);
    }

    const actor = await ensureUserActor(tenantId, userId);
    const authorship = buildFinancialAuthorshipFromRequest({
      performedByUserId: userId,
      actingForActorId: actor.actor_id,
      actingForAccountId: body.fromAccountId,
      authoritySource: 'ownership',
      permissionSnapshot: {
        permissionKey: 'ownership',
        allowed: true,
        actorId: actor.actor_id,
        userId,
        decidedAt: new Date().toISOString(),
      },
    });

    const currency = (body.currency ?? 'BRL') as BankCurrency;
    const context = body.context as BankTransactionContext;

    try {
      const bankTransaction = bankPortsRegistry.getBankTransaction();
      const result = await bankTransaction.createTransactionWithSplit(tenantId, {
        eventId: body.eventId,
        fromAccountId: body.fromAccountId,
        amountCents,
        currency,
        context,
        revenueShareAccountId: body.revenueShareAccountId,
        fromUserId: userId,
        description: body.description,
        metadata: body.metadata as Record<string, unknown> | undefined,
        authorship,
      });

      const t = result.transaction;
      return reply.status(200).send({
        success: true,
        transaction: {
          transactionId: t.transactionId,
          eventId: t.eventId,
          amountCents: t.amountCents,
          currency: t.currency,
          transactionType: t.transactionType,
          fromAccountId: t.fromAccountId ?? null,
          toAccountId: t.toAccountId ?? null,
          status: t.status,
          createdAt: t.createdAt,
        },
        splits: result.splits.map((s) => ({
          splitId: s.splitId,
          targetAccountId: s.targetAccountId,
          amountCents: s.amountCents,
          splitType: s.splitType,
        })),
        ledgerEntries: result.ledgerEntries,
      });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      req.log.error({ err: error, requestId, tenantId, userId }, 'bank.http.split.error');
      const status = err.statusCode ?? 500;
      const code =
        status === 400
          ? 'BAD_REQUEST'
          : status === 403
            ? 'FORBIDDEN'
            : status === 404
              ? 'NOT_FOUND'
              : status === 409
                ? 'CONFLICT'
                : 'INTERNAL_ERROR';
      return sendBankError(reply, req, status, code, err.message || 'Transaction failed');
    }
  });
};

export default bankHttpRoutes;