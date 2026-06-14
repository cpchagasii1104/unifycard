// Financial Approval Repository — DECISION-0128 / F-CORE-FINANCIAL-APPROVAL-MODEL.
//
// Acesso de dados do Core de Aprovação Financeira sobre as tabelas CANÔNICAS
// approval_requests / approval_votes (migration 20260530569000, DECISION-0054;
// governança em 20260614140000). NÃO duplica substrato. NÃO move dinheiro:
// nunca toca bank_*/payout/ledger; nenhuma escrita financeira. Subject (user) e
// tenant SEMPRE server-side (parâmetros), nunca de body/query. Colunas explícitas
// (sem SELECT *). Idempotência por (tenant_id, idempotency_key).

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  ApprovalRequestRow,
  ApprovalVoteRow,
  ApprovalRequestStatus,
  ApprovalVoteType,
  ApprovalOperationType,
  ApprovalType,
} from './financial-approval.types';

const REQUEST_COLS = `
  id, tenant_id, requested_by_user_id, acting_for_actor_id, acting_for_account_id,
  operation_type, operation_data, required_approvals, approval_type, status,
  idempotency_key, expires_at, created_at, updated_at
`;

const VOTE_COLS = `
  id, approval_request_id, voted_by_user_id, vote_type, reason, permission_snapshot, created_at
`;

export interface InsertApprovalRequestParams {
  tenantId: string;
  requestedByUserId: string;
  actingForActorId: string;
  actingForAccountId: string;
  operationType: ApprovalOperationType;
  operationData: Record<string, unknown>;
  requiredApprovals: number;
  approvalType: ApprovalType;
  expiresAt: Date;
  idempotencyKey: string | null;
}

export class ApprovalVoteDuplicateError extends Error {
  constructor() {
    super('APPROVAL_VOTE_ALREADY_CAST');
    this.name = 'ApprovalVoteDuplicateError';
  }
}

// INSERT de request. Em colisão de idempotency_key (23505), retorna a request existente
// (idempotente — não cria duplicata, não levanta erro). Nunca move dinheiro.
export async function insertApprovalRequest(
  p: InsertApprovalRequestParams
): Promise<ApprovalRequestRow> {
  try {
    const row = await runQueryWithTenant<ApprovalRequestRow>(
      p.tenantId,
      `INSERT INTO approval_requests
         (tenant_id, requested_by_user_id, acting_for_actor_id, acting_for_account_id,
          operation_type, operation_data, required_approvals, approval_type, status,
          idempotency_key, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, 'pending', $9, $10)
       RETURNING ${REQUEST_COLS}`,
      [
        p.tenantId,
        p.requestedByUserId,
        p.actingForActorId,
        p.actingForAccountId,
        p.operationType,
        JSON.stringify(p.operationData ?? {}),
        p.requiredApprovals,
        p.approvalType,
        p.idempotencyKey,
        p.expiresAt,
      ]
    );
    return row as ApprovalRequestRow;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === '23505' && p.idempotencyKey) {
      const existing = await findApprovalRequestByIdempotency(p.tenantId, p.idempotencyKey);
      if (existing) return existing;
    }
    throw err;
  }
}

export async function findApprovalRequestById(
  tenantId: string,
  id: string
): Promise<ApprovalRequestRow | undefined> {
  return runQueryWithTenant<ApprovalRequestRow>(
    tenantId,
    `SELECT ${REQUEST_COLS} FROM approval_requests WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [tenantId, id]
  );
}

export async function findApprovalRequestByIdempotency(
  tenantId: string,
  idempotencyKey: string
): Promise<ApprovalRequestRow | undefined> {
  return runQueryWithTenant<ApprovalRequestRow>(
    tenantId,
    `SELECT ${REQUEST_COLS} FROM approval_requests
       WHERE tenant_id = $1 AND idempotency_key = $2 LIMIT 1`,
    [tenantId, idempotencyKey]
  );
}

export interface ListApprovalRequestsFilter {
  status?: ApprovalRequestStatus;
  operationType?: ApprovalOperationType;
  actingForActorId?: string;
  limit?: number;
}

export async function listApprovalRequests(
  tenantId: string,
  filter: ListApprovalRequestsFilter = {}
): Promise<ApprovalRequestRow[]> {
  const conds: string[] = ['tenant_id = $1'];
  const params: unknown[] = [tenantId];
  if (filter.status) {
    params.push(filter.status);
    conds.push(`status = $${params.length}`);
  }
  if (filter.operationType) {
    params.push(filter.operationType);
    conds.push(`operation_type = $${params.length}`);
  }
  if (filter.actingForActorId) {
    params.push(filter.actingForActorId);
    conds.push(`acting_for_actor_id = $${params.length}`);
  }
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
  params.push(limit);
  return runQueriesWithTenant<ApprovalRequestRow>(
    tenantId,
    `SELECT ${REQUEST_COLS} FROM approval_requests
       WHERE ${conds.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
    params
  );
}

// Forward-only status transition (optimistic): só muda se o status atual == fromStatus.
// O trigger de banco congela estado terminal; aqui garantimos a transição causal.
export async function updateApprovalRequestStatus(
  tenantId: string,
  id: string,
  fromStatus: ApprovalRequestStatus,
  toStatus: ApprovalRequestStatus
): Promise<ApprovalRequestRow | undefined> {
  return runQueryWithTenant<ApprovalRequestRow>(
    tenantId,
    `UPDATE approval_requests
        SET status = $4, updated_at = NOW()
      WHERE tenant_id = $1 AND id = $2 AND status = $3
      RETURNING ${REQUEST_COLS}`,
    [tenantId, id, fromStatus, toStatus]
  );
}

// INSERT de voto (decisão). Append-only no banco. Em colisão de
// uq_approval_vote_per_user (23505), levanta ApprovalVoteDuplicateError.
export async function insertApprovalVote(
  tenantId: string,
  params: {
    approvalRequestId: string;
    votedByUserId: string;
    voteType: ApprovalVoteType;
    reason: string | null;
    permissionSnapshot: Record<string, unknown> | null;
  }
): Promise<ApprovalVoteRow> {
  try {
    const row = await runQueryWithTenant<ApprovalVoteRow>(
      tenantId,
      `INSERT INTO approval_votes
         (approval_request_id, voted_by_user_id, vote_type, reason, permission_snapshot)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING ${VOTE_COLS}`,
      [
        params.approvalRequestId,
        params.votedByUserId,
        params.voteType,
        params.reason,
        params.permissionSnapshot ? JSON.stringify(params.permissionSnapshot) : null,
      ]
    );
    return row as ApprovalVoteRow;
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === '23505') {
      throw new ApprovalVoteDuplicateError();
    }
    throw err;
  }
}

export async function listVotesForRequest(
  tenantId: string,
  approvalRequestId: string
): Promise<ApprovalVoteRow[]> {
  return runQueriesWithTenant<ApprovalVoteRow>(
    tenantId,
    `SELECT ${VOTE_COLS} FROM approval_votes
       WHERE approval_request_id = $1
       ORDER BY created_at ASC`,
    [approvalRequestId]
  );
}
