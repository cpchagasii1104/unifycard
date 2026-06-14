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
import { ensureUserActor } from '@modules/identity/actor-writer.service';
import { bankAccountService } from '@modules/bank/bank-account.service';
import { createFinancialApprovalRequest } from '@core/financial-approval/financial-approval.service';

// 🔒 F-BANK-HTTP-AUTHORITY-BINDING (DECISION-0128): os writers move-money de bank-http
// (POST /transactions/simple|split) deixaram de EXECUTAR dinheiro. Agora são REQUEST-ONLY:
// criam uma solicitação de aprovação no Core de Aprovação Financeira (approval_requests),
// com subject/tenant/actor/conta derivados SERVER-SIDE, e NÃO chamam o Bank — nenhuma
// bank_transaction, nenhum bank_ledger, nenhum split é executado. A execução real (após
// aprovação) é frente FUTURA (F-PAYOUT-EXECUTION-SEAL / F-BANK-EXECUTION). GET /balance é
// leitura (subject server-side + actorCapabilitiesService.resolveForUser; actorId = alvo).
const BANK_HTTP_APPROVAL_EXPIRY_MS = 24 * 60 * 60 * 1000;

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

    // F-C1-HOME-READ-SEAL (CP7): falha de auth/tenant NÃO vira saldo falso 200 — erro observável.
    if (!req.user?.id) {
      return reply.status(401).send({ success: false, code: 'UNAUTHENTICATED', error: 'Não autenticado' });
    }

    if (!req.tenant?.id) {
      return reply.status(400).send({ success: false, code: 'TENANT_NOT_FOUND', error: 'Tenant não encontrado' });
    }

    const tenantId = req.tenant.id;
    const userId = req.user.id;
    const actorIdParam = req.query.actorId;

    // Sem identidade bancária (global_user) = AUSÊNCIA honesta sinalizada (hasAccount:false).
    // zero=zero: usuário sem conta tem materialmente saldo 0 — distinto de ERRO (500 abaixo).
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
      // F-C1-HOME-READ-SEAL (CP7): ERRO ESTRUTURAL nunca vira saldo falso (200 + 0). O frontend
      // distingue indisponível (erro) de zero real (sucesso). Leitura pura — nada é criado/curado.
      req.log.error({ err, requestId, userId, tenantId, actorId: actorIdParam }, 'bank.http.balance.error');
      return reply.status(500).send({
        success: false,
        code: 'BANK_BALANCE_UNAVAILABLE',
        error: 'Saldo indisponível (erro estrutural). Não é um saldo zero.',
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

    // 🔒 REQUEST-ONLY (DECISION-0128): cria approval_request no Core; NÃO executa Bank.
    try {
      const approval = await createFinancialApprovalRequest({
        tenantId,
        requestedByUserId: userId,
        actingForActorId: actor.actor_id,
        actingForAccountId: body.fromAccountId,
        operationType: 'transfer',
        operationData: {
          channel: 'bank_http.transactions.simple',
          eventId: body.eventId,
          referenceType: body.referenceType,
          fromAccountId: body.fromAccountId,
          toAccountId: body.toAccountId,
          amountCents,
          currency: body.currency ?? 'BRL',
          transactionType: body.transactionType,
          description: body.description,
          metadata: body.metadata,
        },
        idempotencyKey: `bankhttp:simple:${body.eventId}`,
        expiresAt: new Date(Date.now() + BANK_HTTP_APPROVAL_EXPIRY_MS),
      });
      return reply.status(202).send({
        success: true,
        status: 'requested',
        approvalRequestId: approval.id,
        approvalStatus: approval.status,
        operationType: approval.operation_type,
        executed: false,
        message:
          'Financial execution is request-only: an approval request was created in the Financial Approval Core. The Bank was not called and no money moved.',
      });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      req.log.error({ err: error, requestId, tenantId, userId }, 'bank.http.simple.approval.error');
      return sendBankError(reply, req, err.statusCode ?? 500, 'BANK_HTTP_APPROVAL_REQUEST_FAILED', err.message || 'Approval request failed');
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

    // 🔒 REQUEST-ONLY (DECISION-0128): cria approval_request no Core; NÃO executa split/Bank.
    try {
      const approval = await createFinancialApprovalRequest({
        tenantId,
        requestedByUserId: userId,
        actingForActorId: actor.actor_id,
        actingForAccountId: body.fromAccountId,
        operationType: 'transfer',
        operationData: {
          channel: 'bank_http.transactions.split',
          eventId: body.eventId,
          fromAccountId: body.fromAccountId,
          amountCents,
          currency: body.currency ?? 'BRL',
          context: body.context,
          revenueShareAccountId: body.revenueShareAccountId,
          description: body.description,
          metadata: body.metadata,
        },
        idempotencyKey: `bankhttp:split:${body.eventId}`,
        expiresAt: new Date(Date.now() + BANK_HTTP_APPROVAL_EXPIRY_MS),
      });
      return reply.status(202).send({
        success: true,
        status: 'requested',
        approvalRequestId: approval.id,
        approvalStatus: approval.status,
        operationType: approval.operation_type,
        executed: false,
        message:
          'Financial execution is request-only: an approval request was created in the Financial Approval Core. The Bank was not called and no money moved.',
      });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      req.log.error({ err: error, requestId, tenantId, userId }, 'bank.http.split.approval.error');
      return sendBankError(reply, req, err.statusCode ?? 500, 'BANK_HTTP_APPROVAL_REQUEST_FAILED', err.message || 'Approval request failed');
    }
  });
};

export default bankHttpRoutes;