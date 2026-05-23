// Financial Freeze Repository — tabela financial_freezes.
// Não altera bank_transactions, bank_ledger nem bank_accounts.

import { runQueryWithTenant, pool } from '@core/database/pool';

export type FreezeStatus = 'active' | 'released' | 'cancelled';

export interface FinancialFreeze {
  id: string;
  tenantId: string;
  accountId: string;
  referenceId: string;
  amountCents: number;
  reason: string | null;
  status: FreezeStatus;
  createdAt: string;
  releasedAt: string | null;
}

interface FinancialFreezeRow {
  id: string;
  tenant_id: string;
  account_id: string;
  reference_id: string;
  amount_cents: string;
  reason: string | null;
  status: string;
  created_at: Date;
  released_at: Date | null;
}

function toFreeze(row: FinancialFreezeRow): FinancialFreeze {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    accountId: row.account_id,
    referenceId: row.reference_id,
    amountCents: parseInt(String(row.amount_cents), 10),
    reason: row.reason,
    status: row.status as FreezeStatus,
    createdAt: row.created_at.toISOString(),
    releasedAt: row.released_at ? row.released_at.toISOString() : null,
  };
}

export interface CreateFreezeInput {
  accountId: string;
  referenceId: string;
  amountCents: number;
  reason?: string | null;
}

export async function createFreeze(
  tenantId: string,
  input: CreateFreezeInput
): Promise<FinancialFreeze> {
  const row = await runQueryWithTenant<FinancialFreezeRow>(
    tenantId,
    `INSERT INTO financial_freezes (tenant_id, account_id, reference_id, amount_cents, reason, status)
     VALUES ($1, $2, $3, $4, $5, 'active')
     RETURNING id, tenant_id, account_id, reference_id, amount_cents, reason, status, created_at, released_at`,
    [tenantId, input.accountId, input.referenceId, input.amountCents, input.reason ?? null]
  );
  if (!row) throw new Error('createFreeze: insert failed');
  return toFreeze(row);
}

export async function releaseFreeze(tenantId: string, freezeId: string): Promise<FinancialFreeze> {
  const row = await runQueryWithTenant<FinancialFreezeRow>(
    tenantId,
    `UPDATE financial_freezes
     SET status = 'released', released_at = now()
     WHERE tenant_id = $1 AND id = $2 AND status = 'active'
     RETURNING id, tenant_id, account_id, reference_id, amount_cents, reason, status, created_at, released_at`,
    [tenantId, freezeId]
  );
  if (!row) throw new Error('releaseFreeze: freeze not found or not active');
  return toFreeze(row);
}

export async function cancelFreeze(tenantId: string, freezeId: string): Promise<FinancialFreeze> {
  const row = await runQueryWithTenant<FinancialFreezeRow>(
    tenantId,
    `UPDATE financial_freezes
     SET status = 'cancelled', released_at = now()
     WHERE tenant_id = $1 AND id = $2 AND status = 'active'
     RETURNING id, tenant_id, account_id, reference_id, amount_cents, reason, status, created_at, released_at`,
    [tenantId, freezeId]
  );
  if (!row) throw new Error('cancelFreeze: freeze not found or not active');
  return toFreeze(row);
}

export async function listActiveFreezes(accountId: string): Promise<FinancialFreeze[]> {
  const result = await pool.query<FinancialFreezeRow>(
    `SELECT id, tenant_id, account_id, reference_id, amount_cents, reason, status, created_at, released_at
     FROM financial_freezes
     WHERE account_id = $1 AND status = 'active'
     ORDER BY created_at DESC`,
    [accountId]
  );
  return result.rows.map(toFreeze);
}

/** Lista freezes ativos, opcionalmente por tenant e/ou account. */
export async function listActiveFreezesFiltered(tenantId?: string, accountId?: string): Promise<FinancialFreeze[]> {
  const conditions: string[] = ["status = 'active'"];
  const params: string[] = [];
  let i = 1;
  if (tenantId) {
    conditions.push(`tenant_id = $${i++}`);
    params.push(tenantId);
  }
  if (accountId) {
    conditions.push(`account_id = $${i++}`);
    params.push(accountId);
  }
  const result = await pool.query<FinancialFreezeRow>(
    `SELECT id, tenant_id, account_id, reference_id, amount_cents, reason, status, created_at, released_at
     FROM financial_freezes
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC`,
    params
  );
  return result.rows.map(toFreeze);
}