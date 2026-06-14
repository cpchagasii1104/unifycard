// backend/src/modules/payout/payout-approval.service.ts
// F-PAYOUT-APPROVAL-POLICY-MATERIALIZATION — orquestrador de aprovação de payout (DECISION-0130).
//
// Faz a ponte entre a DECISÃO material do Core (payoutApprovalPolicyService.decidePayoutApproval —
// policy/authority/faixa MVP/travas D7/limite diário + evento append-only) e o BRIDGE selado
// (actorWalletPayoutService.approveActorWalletPayout — registra voto no Core + flip pending_approval→
// approved). Vive no MÓDULO (não no Core) justamente porque chama o bridge do módulo wallet — assim a
// ROTA nunca referencia approveActorWalletPayout (execution-seal guard permanece verde).
//
// INVARIANTE: APROVAR NÃO EXECUTA. O bridge NÃO move dinheiro (sem Bank/worker/executor; executed:false).
// Só chama o bridge quando a política material aprova.

import {
  payoutApprovalPolicyService,
  type PayoutApprovalDecisionInput,
} from '@core/financial-approval/payout-approval-policy.service';
import { actorWalletPayoutService } from '@modules/wallet/actor-wallet-payout.service';

// `kind` = discriminante string-literal (narrowing estável sob tsconfig.build `strict:false`).
export type PayoutApprovalResult =
  | {
      kind: 'approved';
      approved: true;
      approvalStatus: 'approved';
      payoutStatus: 'approved';
      policyId: string;
      authorityId: string;
      eventId: string;
    }
  | { kind: 'blocked'; approved: false; httpStatus: number; code: string; reason: string };

class PayoutApprovalService {
  /**
   * Decide (Core material) e, se aprovado, registra o voto + aprova o payout via bridge selado.
   * NÃO move dinheiro. Retorna executed:false a montante (a rota).
   */
  async approvePayoutDecision(input: PayoutApprovalDecisionInput): Promise<PayoutApprovalResult> {
    const decision = await payoutApprovalPolicyService.decidePayoutApproval(input);
    if (decision.kind === 'blocked') {
      return { kind: 'blocked', approved: false, httpStatus: decision.httpStatus, code: decision.code, reason: decision.reason };
    }
    // Política material aprovou → registra voto no Core + flip pending_approval→approved (bridge selado,
    // system-only, sem dinheiro). Idempotente: re-chamada com já-approved retorna sem novo efeito.
    await actorWalletPayoutService.approveActorWalletPayout(
      input.tenantId,
      input.payoutRequestId,
      input.approverUserId
    );
    return {
      kind: 'approved',
      approved: true,
      approvalStatus: 'approved',
      payoutStatus: 'approved',
      policyId: decision.policyId,
      authorityId: decision.authorityId,
      eventId: decision.eventId,
    };
  }
}

export const payoutApprovalService = new PayoutApprovalService();
