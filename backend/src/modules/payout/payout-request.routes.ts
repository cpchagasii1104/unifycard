// backend/src/modules/payout/payout-request.routes.ts
// F-PAYOUT-REQUEST-ONLY-ENTRYPOINT (DECISION-0128).
//
// Entrada HTTP REQUEST-ONLY de payout. Cria SOMENTE a solicitação (actor_wallet_payout_requests
// 'pending_approval' + approval_requests 'pending' via requestActorWalletPayout). NUNCA aprova,
// NUNCA executa, NUNCA chama worker/Bank, NUNCA move dinheiro.
//
// Autoridade (server-side, fail-closed):
//   subject = req.user.id (authorship → requested_by_user_id); tenant = req.tenant.id;
//   actorId do body = HINT/alvo → gate authorizationService.canRepresentActor(tenantId, req.user.id, actorId).
//   NÃO usa businessAuthorizationService / organization_members / company_users / tenant_operator_grants /
//   financial:execute_payout / can_execute_* / actionContext / x-actor-id / query actorId como subject.
//
// Aprovação = frente FUTURA bloqueada por decisão de Clayton (sem 4-olhos, sem multi-approval aqui).

import { randomUUID } from 'crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authorizationService } from '@core/authorization/authorization.service';
import { actorWalletPayoutService, ActorWalletPayoutError } from '@modules/wallet/actor-wallet-payout.service';

const payoutRequestBodySchema = z
  .object({
    actorId: z.string().uuid(),
    amountCents: z.union([z.number(), z.string()]),
    reason: z.string().min(1).max(2000),
    idempotencyKey: z.string().min(1).max(255).optional(),
  })
  .strip(); // ignora chaves extras (requestedByUserId/tenantId/status/operationType/approvalRequestId/availableBalanceCents)

function fail(reply: FastifyReply, status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return reply.status(status).send({ ok: false, code, message, ...(extra ?? {}) });
}

const payoutRequestRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /api/payouts/requests — REQUEST-ONLY. Cria solicitação de payout (pending_approval).
   * NÃO aprova, NÃO executa, NÃO move dinheiro.
   */
  fastify.post('/payouts/requests', async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.user?.id;
    if (!userId) return fail(reply, 401, 'UNAUTHORIZED', 'Authentication required');
    if (!req.tenant?.id) return fail(reply, 400, 'TENANT_REQUIRED', 'Tenant context required');
    const tenantId = req.tenant.id;

    const parsed = payoutRequestBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(reply, 400, 'VALIDATION_ERROR', 'Invalid request body', { issues: parsed.error.flatten() });
    }
    const body = parsed.data;

    // amount_cents: inteiro positivo.
    const amountCents = typeof body.amountCents === 'number' ? body.amountCents : Number(body.amountCents);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return fail(reply, 400, 'INVALID_AMOUNT_CENTS', 'amountCents deve ser inteiro positivo (centavos).');
    }

    // 🔒 Autoridade: actorId do cliente é HINT — só prossegue se req.user pode REPRESENTAR o actor (fail-closed).
    const canRepresent = await authorizationService.canRepresentActor(tenantId, userId, body.actorId);
    if (!canRepresent) {
      return fail(reply, 403, 'ACTOR_NOT_REPRESENTABLE', 'User cannot represent this actor for a payout request.');
    }

    // idempotência: usa a chave fornecida ou gera uma (request única). Service exige idempotencyKey.
    const idempotencyKey = body.idempotencyKey ?? randomUUID();

    try {
      const res = await actorWalletPayoutService.requestActorWalletPayout({
        tenantId,
        actorId: body.actorId,
        requestedByUserId: userId, // SERVER-SIDE — nunca do body.
        requestedAmountCents: amountCents,
        idempotencyKey,
        reason: body.reason,
      });
      return reply.status(res.alreadyExisted ? 200 : 201).send({
        ok: true,
        status: res.payoutRequest.status, // 'pending_approval'
        payoutRequestId: res.payoutRequest.id,
        approvalRequestId: res.payoutRequest.approvalRequestId ?? null,
        executed: false, // request-only: aprovação/execução são frentes separadas.
        alreadyExisted: res.alreadyExisted,
        balanceSnapshot: res.balanceSnapshot, // INFORMATIVO — não é autoridade/SSOT.
      });
    } catch (error) {
      if (error instanceof ActorWalletPayoutError) {
        switch (error.code) {
          case 'ACTOR_WALLET_NOT_FOUND':
            return fail(reply, 404, error.code, error.message);
          case 'ACTOR_WALLET_PAYOUT_ALREADY_ACTIVE':
            return fail(reply, 409, error.code, error.message);
          case 'ACTOR_WALLET_PAYOUT_INSUFFICIENT_AVAILABLE_BALANCE':
            return fail(reply, 422, error.code, error.message);
          case 'ACTOR_WALLET_PAYOUT_AMOUNT_ZERO':
          case 'ACTOR_WALLET_PAYOUT_MISSING_IDEMPOTENCY_KEY':
          case 'ACTOR_WALLET_PAYOUT_MISSING_REASON':
          case 'ACTOR_WALLET_PAYOUT_MISSING_REQUESTED_BY':
            return fail(reply, 400, error.code, error.message);
          default:
            return fail(reply, 500, 'PAYOUT_REQUEST_FAILED', error.message);
        }
      }
      req.log.error({ err: error, tenantId, userId }, 'payout.request.error');
      return fail(reply, 500, 'PAYOUT_REQUEST_FAILED', 'Payout request failed');
    }
  });
};

export default payoutRequestRoutes;
