// Financial Dispute Repository — tabela financial_disputes.
// Não altera bank_transactions, bank_ledger nem bank_accounts.

import { runQueryWithTenant, pool } from '@core/database/pool';

export type DisputeStatus = 'opened' | 'under_review' | 'resolved' | 'rejected';

export interface FinancialDispute {
  id: string;
  tenantId: string;
  referenceId: string;
  disputeType: string;
  amountCents: number;
  status: DisputeStatus;
  createdAt: string;
  resolvedAt: string | null;
}

interface FinancialDisputeRow {
  id: string;
  tenant_id: string;
  reference_id: string;
  dispute_type: string;
  amount_cents: string;
  status: string;
  created_at: Date;
  resolved_at: Date | null;
}

function toDispute(row: FinancialDisputeRow): FinancialDispute {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    referenceId: row.reference_id,
    disputeType: row.dispute_type,
    amountCents: parseInt(String(row.amount_cents), 10),
    status: row.status as DisputeStatus,
    createdAt: row.created_at.toISOString(),
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
  };
}

export interface CreateDisputeInput {
  referenceId: string;
  disputeType: string;
  amountCents: number;
}

export async function createDispute(
  tenantId: string,
  input: CreateDisputeInput
): Promise<FinancialDispute> {
  const row = await runQueryWithTenant<FinancialDisputeRow>(
    tenantId,
    `INSERT INTO financial_disputes (tenant_id, reference_id, dispute_type, amount_cents, status)
     VALUES ($1, $2, $3, $4, 'opened')
     RETURNING id, tenant_id, reference_id, dispute_type, amount_cents, status, created_at, resolved_at`,
    [tenantId, input.referenceId, input.disputeType, input.amountCents]
  );
  if (!row) throw new Error('createDispute: insert failed');
  return toDispute(row);
}

export async function getDisputeByReference(
  tenantId: string,
  referenceId: string
): Promise<FinancialDispute | null> {
  const row = await runQueryWithTenant<FinancialDisputeRow>(
    tenantId,
    `SELECT id, tenant_id, reference_id, dispute_type, amount_cents, status, created_at, resolved_at
     FROM financial_disputes WHERE tenant_id = $1 AND reference_id = $2`,
    [tenantId, referenceId]
  );
  return row ? toDispute(row) : null;
}

export async function updateDisputeStatus(
  tenantId: string,
  disputeId: string,
  status: DisputeStatus
): Promise<FinancialDispute> {
  const row = await runQueryWithTenant<FinancialDisputeRow>(
    tenantId,
    `UPDATE financial_disputes
     SET status = $3, resolved_at = CASE WHEN $3 IN ('resolved', 'rejected') THEN now() ELSE resolved_at END
     WHERE tenant_id = $1 AND id = $2
     RETURNING id, tenant_id, reference_id, dispute_type, amount_cents, status, created_at, resolved_at`,
    [tenantId, disputeId, status]
  );
  if (!row) throw new Error('updateDisputeStatus: dispute not found');
  return toDispute(row);
}

export async function listOpenDisputes(tenantId?: string): Promise<FinancialDispute[]> {
  const query =
    tenantId === undefined
      ? `SELECT id, tenant_id, reference_id, dispute_type, amount_cents, status, created_at, resolved_at
         FROM financial_disputes WHERE status IN ('opened', 'under_review') ORDER BY created_at DESC`
      : `SELECT id, tenant_id, reference_id, dispute_type, amount_cents, status, created_at, resolved_at
         FROM financial_disputes WHERE tenant_id = $1 AND status IN ('opened', 'under_review') ORDER BY created_at DESC`;
  const result = await pool.query<FinancialDisputeRow>(
    query,
    tenantId === undefined ? [] : [tenantId]
  );
  return result.rows.map(toDispute);
}