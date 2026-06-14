// backend/src/modules/payout/payout-decision.routes.ts
// F-PAYOUT-APPROVAL-POLICY-MATERIALIZATION — endpoint de DECISÃO de aprovação de payout (DECISION-0130).
//
// POST /api/payouts/requests/:payoutRequestId/decision — aprova payout DENTRO da faixa MVP via Core
// Financeiro material (policy + authority do operador + travas D7 + limite diário), registrando a decisão
// e mudando approval/payout para 'approved'. **APROVAR NÃO EXECUTA** (executed:false).
//
// A rota só faz pré-checagens baratas (resolve payout/approval, tipo/estado, requester≠approver) e delega
// a DECISÃO + bridge ao orquestrador `payoutApprovalService` (módulo). A ROTA NUNCA chama
// approveActorWalletPayout / recordFinancialApprovalDecision / executeActorWalletPayout / worker / Bank
// (esses ficam no orquestrador/bridge selado — execution-seal permanece verde).
//
// Autoridade (server-side): subject(aprovador)=req.user.id; tenant=req.tenant.id. NUNCA aceita
// approvedByUserId/tenantId/status/operationType/approvalRequestId/amount/availableBalanceCents do body.
// payoutRequestId vem do path (recurso) — sem canal DECISION-0113.

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { actorWalletPayoutService } from '@modules/wallet/actor-wallet-payout.service';
import { ACTOR_WALLET_PAYOUT_OPERATION_TYPE } from '@modules/wallet/actor-wallet-payout-request.types';
import { findApprovalRequestById } from '@core/financial-approval/financial-approval.repository';
import { payoutApprovalService } from './payout-approval.service';

const decisionBodySchema = z
  .object({
    decision: z.literal('approve'),
    reason: z.string().min(1).max(2000).optional(),
  })
  .strip(); // descarta approvedByUserId/tenantId/status/operationType/approvalRequestId/amount/availableBalanceCents

function fail(reply: FastifyReply, status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return reply.status(status).send({ ok: false, code, message, ...(extra ?? {}) });
}

const payoutDecisionRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /api/payouts/requests/:payoutRequestId/decision — aprovação material (DECISION-0130).
   * Não move dinheiro, não executa, não chama worker/Bank.
   */
  fastify.post<{ Params: { payoutRequestId: string } }>(
    '/payouts/requests/:payoutRequestId/decision',
    async (req: FastifyRequest<{ Params: { payoutRequestId: string } }>, reply: FastifyReply) => {
      const approverUserId = req.user?.id;
      if (!approverUserId) return fail(reply, 401, 'UNAUTHORIZED', 'Authentication required');
      if (!req.tenant?.id) return fail(reply, 400, 'TENANT_REQUIRED', 'Tenant context required');
      const tenantId = req.tenant.id;

      const payoutRequestId = req.params.payoutRequestId;
      if (!payoutRequestId) return fail(reply, 400, 'PAYOUT_REQUEST_ID_REQUIRED', 'payoutRequestId is required');

      const parsed = decisionBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return fail(reply, 400, 'VALIDATION_ERROR', 'Invalid decision body (decision must be "approve").', {
          issues: parsed.error.flatten(),
        });
      }

      // 1. Resolve o payout_request por id+tenant (server-side). 404 se não existir NESTE tenant.
      const payout = await actorWalletPayoutService.getActorWalletPayoutRequestById(tenantId, payoutRequestId);
      if (!payout) {
        return fail(reply, 404, 'PAYOUT_REQUEST_NOT_FOUND', `payout_request ${payoutRequestId} not found in tenant.`);
      }
      if (payout.status !== 'pending_approval') {
        return fail(reply, 409, 'PAYOUT_NOT_PENDING_APPROVAL',
          `payout_request status='${payout.status}', expected 'pending_approval'.`,
          { executed: false, payoutStatus: payout.status });
      }
      if (!payout.approvalRequestId) {
        return fail(reply, 422, 'PAYOUT_APPROVAL_NOT_FOUND',
          `payout_request ${payoutRequestId} has no linked approval_request.`, { executed: false });
      }

      // 2. Resolve o approval_request VIA Core. Valida tipo/estado.
      const approval = await findApprovalRequestById(tenantId, payout.approvalRequestId);
      if (!approval) {
        return fail(reply, 404, 'PAYOUT_APPROVAL_NOT_FOUND',
          `approval_request ${payout.approvalRequestId} not found.`, { executed: false });
      }
      if (approval.operation_type !== ACTOR_WALLET_PAYOUT_OPERATION_TYPE) {
        return fail(reply, 422, 'PAYOUT_APPROVAL_WRONG_TYPE',
          `approval_request operation_type='${approval.operation_type}', expected '${ACTOR_WALLET_PAYOUT_OPERATION_TYPE}'.`,
          { executed: false });
      }
      if (approval.status !== 'pending') {
        return fail(reply, 409, 'PAYOUT_APPROVAL_NOT_PENDING',
          `approval_request status='${approval.status}', expected 'pending'.`,
          { executed: false, approvalStatus: approval.status });
      }

      // 3. 🔒 SEGREGAÇÃO (D3): solicitante NÃO aprova o próprio payout. Barra ANTES da política.
      if (approval.requested_by_user_id === approverUserId) {
        return fail(reply, 403, 'PAYOUT_APPROVER_CANNOT_BE_REQUESTER',
          'The requester of a payout cannot approve it (segregation of duty — 4-eyes minimum).',
          { executed: false, approvalStatus: 'pending', payoutStatus: 'pending_approval' });
      }

      // 4. 🔒 DECISÃO MATERIAL (Core: policy + authority + faixa MVP + D7 + diário) + bridge se aprovado.
      //    NÃO move dinheiro. A rota não chama o bridge — o orquestrador (módulo) chama.
      try {
        const result = await payoutApprovalService.approvePayoutDecision({
          tenantId,
          approverUserId,
          payoutRequestId,
          approvalRequestId: payout.approvalRequestId,
          actorId: payout.actorId,
          requestedByUserId: approval.requested_by_user_id,
          requestedAmountCents: payout.requestedAmountCents,
          destinationType: payout.destinationType,
        });

        if (result.kind === 'blocked') {
          // Bloqueado pela política/faixa/trava/limite — nada é aprovado.
          return fail(reply, result.httpStatus, result.code, result.reason, {
            executed: false,
            approvalStatus: 'pending',
            payoutStatus: 'pending_approval',
          });
        }

        // ✅ Aprovado dentro da faixa MVP — approval e payout viram 'approved'. NÃO executa.
        return reply.status(200).send({
          ok: true,
          payoutRequestId,
          approvalRequestId: payout.approvalRequestId,
          approvalStatus: result.approvalStatus, // 'approved'
          payoutStatus: result.payoutStatus,     // 'approved'
          executed: false,                        // execução = worker system-only, NUNCA por HTTP.
          policyId: result.policyId,
          authorityId: result.authorityId,
        });
      } catch (error) {
        req.log.error({ err: error, tenantId, payoutRequestId }, 'payout.decision.error');
        return fail(reply, 500, 'PAYOUT_DECISION_FAILED', 'Payout approval decision failed', { executed: false });
      }
    }
  );
};

export default payoutDecisionRoutes;
