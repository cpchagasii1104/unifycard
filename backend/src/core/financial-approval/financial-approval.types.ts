// Financial Approval Substrate — canonical types
// DECISION-0054 / CORE_APROVACAO_FINANCEIRA_CANONICO §7.2 (2026-05-27)
//
// Substrato de aprovação financeira materializado por
// migration 20260530569000_financial_approval_substrate.sql.
//
// Estes tipos documentam o contrato das tabelas approval_requests e
// approval_votes. NÃO incluem service nem repository — frentes futuras.

export type ApprovalOperationType =
  | 'transfer'
  | 'payment'
  | 'manual_refund'
  | 'actor_wallet_recovery'  // DECISION-0053: recovery pós-D-money
  | 'actor_wallet_payout'    // DECISION-0058: saque voluntário de actor_wallet (F1 migration 20260530572000)
  | 'add_beneficiary'
  | 'remove_beneficiary'
  | 'change_limit'
  | 'change_policy';

export type ApprovalType = 'sequential' | 'parallel';

export type ApprovalRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'cancelled';

export type ApprovalVoteType = 'approve' | 'reject';

export interface ApprovalRequestRow {
  id: string;
  tenant_id: string;
  requested_by_user_id: string;
  acting_for_actor_id: string;
  acting_for_account_id: string;
  operation_type: ApprovalOperationType;
  operation_data: Record<string, unknown>;
  required_approvals: number;
  approval_type: ApprovalType;
  status: ApprovalRequestStatus;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ApprovalVoteRow {
  id: string;
  approval_request_id: string;
  voted_by_user_id: string;
  vote_type: ApprovalVoteType;
  reason: string | null;
  permission_snapshot: Record<string, unknown> | null;
  created_at: Date;
}

export interface CreateApprovalRequestInput {
  tenantId: string;
  requestedByUserId: string;
  actingForActorId: string;
  actingForAccountId: string;
  operationType: ApprovalOperationType;
  operationData: Record<string, unknown>;
  requiredApprovals?: number;
  approvalType?: ApprovalType;
  expiresAt: Date;
}

export interface CastApprovalVoteInput {
  approvalRequestId: string;
  votedByUserId: string;
  voteType: ApprovalVoteType;
  reason?: string;
  permissionSnapshot?: Record<string, unknown>;
}
