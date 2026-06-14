// Financial Approval Service — DECISION-0128 / F-CORE-FINANCIAL-APPROVAL-MODEL.
//
// 🔒 NÚCLEO NÃO-EXECUTOR ("a sala de aprovação, não a porta do cofre").
// Registra solicitação, registra decisão (voto) e resolve o estado de aprovação
// (pending/approved/rejected/expired). NUNCA executa operação financeira:
//   - NÃO move dinheiro, NÃO escreve bank_ledger/bank_transactions/bank_splits;
//   - NÃO chama payout/transfer/reversal/settlement/cartão;
//   - o approval record NÃO é saldo, NÃO é ledger, NÃO autoriza sozinho movimento.
// É trilha material de autoridade, decisão e governança. O wiring de execução
// (bank-http/payout/reversal/cartão) é frente FUTURA e separada (DECISION-0128 §16).
//
// Invariantes: subject (user) e tenant SEMPRE server-side (parâmetros do caller,
// nunca de body/query); actorId do cliente é hint, nunca subject; amount_cents (no
// operation_data) é BIGINT-safe; decisão é append-only; estado terminal não regride.

import {
  insertApprovalRequest,
  findApprovalRequestById,
  listApprovalRequests,
  updateApprovalRequestStatus,
  insertApprovalVote,
  listVotesForRequest,
  type ListApprovalRequestsFilter,
} from './financial-approval.repository';
import type {
  ApprovalRequestRow,
  CreateFinancialApprovalRequestInput,
  RecordFinancialApprovalDecisionInput,
  RecordFinancialApprovalDecisionResult,
  FinancialApprovalRequestView,
} from './financial-approval.types';

export class FinancialApprovalError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'FinancialApprovalError';
  }
}

function assertServerSide(value: string | undefined | null, field: string): string {
  if (!value || typeof value !== 'string') {
    throw new FinancialApprovalError(`MISSING_SERVER_SIDE_${field}`);
  }
  return value;
}

// REQUEST — solicitação de operação financeira. Não move dinheiro, não altera Bank/payout/saldo.
export async function createFinancialApprovalRequest(
  input: CreateFinancialApprovalRequestInput
): Promise<ApprovalRequestRow> {
  const tenantId = assertServerSide(input.tenantId, 'TENANT');
  const requestedByUserId = assertServerSide(input.requestedByUserId, 'SUBJECT');
  assertServerSide(input.actingForActorId, 'ACTING_ACTOR');
  assertServerSide(input.actingForAccountId, 'ACTING_ACCOUNT');
  if (!input.expiresAt || Number.isNaN(input.expiresAt.getTime())) {
    throw new FinancialApprovalError('INVALID_EXPIRES_AT');
  }
  const requiredApprovals = input.requiredApprovals ?? 1;
  if (!Number.isInteger(requiredApprovals) || requiredApprovals < 1) {
    throw new FinancialApprovalError('INVALID_REQUIRED_APPROVALS');
  }

  return insertApprovalRequest({
    tenantId,
    requestedByUserId,
    actingForActorId: input.actingForActorId,
    actingForAccountId: input.actingForAccountId,
    operationType: input.operationType,
    operationData: input.operationData ?? {},
    requiredApprovals,
    approvalType: input.approvalType ?? 'sequential',
    expiresAt: input.expiresAt,
    idempotencyKey: input.idempotencyKey ?? null,
  });
}

// DECISION — registra um voto e RESOLVE o estado. NUNCA executa a operação financeira.
export async function recordFinancialApprovalDecision(
  input: RecordFinancialApprovalDecisionInput
): Promise<RecordFinancialApprovalDecisionResult> {
  const tenantId = assertServerSide(input.tenantId, 'TENANT');
  const votedByUserId = assertServerSide(input.votedByUserId, 'SUBJECT');

  const request = await findApprovalRequestById(tenantId, input.approvalRequestId);
  if (!request) throw new FinancialApprovalError('APPROVAL_REQUEST_NOT_FOUND');

  // Estado terminal não aceita nova decisão (fluxo causal não regride).
  if (request.status !== 'pending') {
    throw new FinancialApprovalError(`APPROVAL_REQUEST_NOT_PENDING:${request.status}`);
  }

  // Expiração: se passou o deadline, marca expired e recusa o voto (sem execução).
  if (request.expires_at && request.expires_at.getTime() < Date.now()) {
    const expired =
      (await updateApprovalRequestStatus(tenantId, request.id, 'pending', 'expired')) ?? request;
    throw Object.assign(new FinancialApprovalError('APPROVAL_REQUEST_EXPIRED'), {
      request: expired,
    });
  }

  // Registra o voto (append-only; um por usuário — repo levanta duplicata).
  const vote = await insertApprovalVote(tenantId, {
    approvalRequestId: request.id,
    votedByUserId,
    voteType: input.voteType,
    reason: input.reason ?? null,
    permissionSnapshot: input.permissionSnapshot ?? null,
  });

  const votes = await listVotesForRequest(tenantId, request.id);
  const approveCount = votes.filter((v) => v.vote_type === 'approve').length;
  const hasReject = votes.some((v) => v.vote_type === 'reject');

  // Resolução do estado — SEM execução financeira de qualquer tipo.
  let updated = request;
  let outcome: RecordFinancialApprovalDecisionResult['outcome'] = 'pending';
  if (hasReject) {
    updated = (await updateApprovalRequestStatus(tenantId, request.id, 'pending', 'rejected')) ?? request;
    outcome = 'rejected';
  } else if (approveCount >= request.required_approvals) {
    updated = (await updateApprovalRequestStatus(tenantId, request.id, 'pending', 'approved')) ?? request;
    outcome = 'approved';
  }

  // ⚠️ NÃO há executor aqui. 'approved' significa apenas que a operação ESTÁ APTA a ser
  // executada por uma frente futura (bank-http/payout/reversal/cartão), que aplicará
  // ATL/KYC/KYB/Guarda/risco/recovery/limites e só então chamará o Bank.
  return {
    request: updated,
    vote,
    outcome,
    approveCount,
    requiredApprovals: request.required_approvals,
    executed: false,
  };
}

// Cancelamento (pending → cancelled). Não move dinheiro.
export async function cancelFinancialApprovalRequest(
  tenantId: string,
  approvalRequestId: string
): Promise<ApprovalRequestRow> {
  assertServerSide(tenantId, 'TENANT');
  const cancelled = await updateApprovalRequestStatus(
    tenantId,
    approvalRequestId,
    'pending',
    'cancelled'
  );
  if (!cancelled) throw new FinancialApprovalError('APPROVAL_REQUEST_NOT_CANCELLABLE');
  return cancelled;
}

export async function getFinancialApprovalRequest(
  tenantId: string,
  approvalRequestId: string
): Promise<FinancialApprovalRequestView> {
  assertServerSide(tenantId, 'TENANT');
  const request = await findApprovalRequestById(tenantId, approvalRequestId);
  if (!request) throw new FinancialApprovalError('APPROVAL_REQUEST_NOT_FOUND');
  const votes = await listVotesForRequest(tenantId, approvalRequestId);
  return {
    request,
    votes,
    approveCount: votes.filter((v) => v.vote_type === 'approve').length,
  };
}

export async function listFinancialApprovalRequests(
  tenantId: string,
  filter: ListApprovalRequestsFilter = {}
): Promise<ApprovalRequestRow[]> {
  assertServerSide(tenantId, 'TENANT');
  return listApprovalRequests(tenantId, filter);
}
