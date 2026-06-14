// backend/src/modules/payout/payout-decision.routes.ts
// F-PAYOUT-APPROVE-ENDPOINT-CORE-AUTHORITY — CAMINHO B / FAIL-CLOSED (DECISION-0129).
//
// Endpoint HTTP de DECISÃO de aprovação de payout. Materializa o approve endpoint autorizado por
// DECISION-0129 (D14) no modo **FAIL-CLOSED**: a rota existe, resolve o payout_request + o
// approval_request, valida tenant/tipo/estado e a SEGREGAÇÃO DE FUNÇÃO (requester != approver, D3),
// e então detecta que **não há política/faixa de aprovação material promulgada** (D2/D4/D6) →
// retorna `PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED`. A aprovação **NÃO acontece**: approval continua
// 'pending', payout continua 'pending_approval', `executed:false`.
//
// HARD STOPS (DECISION-0129 D10/D12/D14):
//   - NUNCA chama approveActorWalletPayout (sem política/autoridade Core material → fail-closed).
//   - NUNCA chama recordFinancialApprovalDecision (não registra voto 'approve').
//   - NUNCA chama executeActorWalletPayout / worker / Bank. NUNCA escreve bank_*/approval_*.
//   - NUNCA usa company_users/tenant_operator_grants/organization_members/businessAuthorizationService/
//     availableBalanceCents/seller_available/payout_requests legado como autoridade de aprovação.
//   - NUNCA cria can_execute_* nem hardcoda faixa de valor.
//
// Autoridade (server-side): subject(aprovador) = req.user.id; tenant = req.tenant.id. NUNCA aceita
// approvedByUserId/tenantId/status/operationType/approvalRequestId do body (zod .strip()). O
// payoutRequestId vem do path (recurso), nunca actorId client-declared — sem canal DECISION-0113.

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { actorWalletPayoutService } from '@modules/wallet/actor-wallet-payout.service';
import { ACTOR_WALLET_PAYOUT_OPERATION_TYPE } from '@modules/wallet/actor-wallet-payout-request.types';
import { findApprovalRequestById } from '@core/financial-approval/financial-approval.repository';
import { resolvePayoutApprovalPolicy } from './payout-approval-policy';

// decision = 'approve' (único valor aceito nesta frente; reject/multi-approval = futuro).
// reason opcional. .strip() descarta chaves extras (approvedByUserId/tenantId/status/operationType/
// approvalRequestId/availableBalanceCents) — nunca viram autoridade.
const decisionBodySchema = z
  .object({
    decision: z.literal('approve'),
    reason: z.string().min(1).max(2000).optional(),
  })
  .strip();

function fail(reply: FastifyReply, status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return reply.status(status).send({ ok: false, code, message, ...(extra ?? {}) });
}

const payoutDecisionRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /api/payouts/requests/:payoutRequestId/decision — aprovação de payout (FAIL-CLOSED).
   * Não move dinheiro, não executa, não chama worker/Bank, não registra voto 'approve'.
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

      // 2. Só decide payout ainda pendente de aprovação (estado terminal/aprovado não regride).
      if (payout.status !== 'pending_approval') {
        return fail(reply, 409, 'PAYOUT_NOT_PENDING_APPROVAL',
          `payout_request status='${payout.status}', expected 'pending_approval'.`,
          { executed: false, payoutStatus: payout.status });
      }
      if (!payout.approvalRequestId) {
        return fail(reply, 422, 'PAYOUT_APPROVAL_NOT_FOUND',
          `payout_request ${payoutRequestId} has no linked approval_request.`, { executed: false });
      }

      // 3. Resolve o approval_request vinculado VIA Core (sem SQL cru de approval). 404 se ausente.
      const approval = await findApprovalRequestById(tenantId, payout.approvalRequestId);
      if (!approval) {
        return fail(reply, 404, 'PAYOUT_APPROVAL_NOT_FOUND',
          `approval_request ${payout.approvalRequestId} not found.`, { executed: false });
      }
      // 4. Tipo canônico (defesa contra approval cruzado/divergente).
      if (approval.operation_type !== ACTOR_WALLET_PAYOUT_OPERATION_TYPE) {
        return fail(reply, 422, 'PAYOUT_APPROVAL_WRONG_TYPE',
          `approval_request operation_type='${approval.operation_type}', expected '${ACTOR_WALLET_PAYOUT_OPERATION_TYPE}'.`,
          { executed: false });
      }
      // 5. Approval precisa estar pendente (não decidido).
      if (approval.status !== 'pending') {
        return fail(reply, 409, 'PAYOUT_APPROVAL_NOT_PENDING',
          `approval_request status='${approval.status}', expected 'pending'.`,
          { executed: false, approvalStatus: approval.status });
      }

      // 6. 🔒 SEGREGAÇÃO DE FUNÇÃO (DECISION-0129 D3): solicitante NÃO pode aprovar o próprio payout.
      //    requested_by_user_id vem do approval (server-side); approverUserId = req.user (server-side).
      if (approval.requested_by_user_id === approverUserId) {
        return fail(reply, 403, 'PAYOUT_APPROVER_CANNOT_BE_REQUESTER',
          'The requester of a payout cannot approve it (segregation of duty — 4-eyes minimum).',
          { executed: false, approvalStatus: 'pending', payoutStatus: 'pending_approval' });
      }

      // 7. 🔒 POLÍTICA/FAIXA DE APROVAÇÃO (DECISION-0129 D2/D4/D6) — FAIL-CLOSED.
      //    Sem autoridade Core Financeiro material NEM faixa segura promulgada, NÃO se aprova.
      const policy = resolvePayoutApprovalPolicy({
        tenantId,
        operationType: approval.operation_type,
        requestedAmountCents: payout.requestedAmountCents,
        requestedByUserId: approval.requested_by_user_id,
        approverUserId,
      });

      // FAIL-CLOSED: política/faixa ausente → nada é aprovado. approval permanece 'pending',
      // payout permanece 'pending_approval'. (Discrimina por policy.code — string-literal.)
      if (policy.code === 'PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED') {
        return fail(reply, 422, policy.code, policy.reason, {
          executed: false,
          approvalStatus: 'pending',
          payoutStatus: 'pending_approval',
        });
      }

      // CAMINHO A (futuro): com política material promulgada, aqui entraria recordFinancialApprovalDecision +
      // approveActorWalletPayout (executed:false). Inalcançável hoje — o resolvedor é fail-closed (D6).
      return fail(reply, 500, 'PAYOUT_APPROVAL_UNREACHABLE',
        'Approval path reached without a promulgated policy — fail-closed invariant violated.',
        { executed: false });
    }
  );
};

export default payoutDecisionRoutes;
