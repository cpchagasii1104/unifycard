// Bank Settlement Repository — tabela bank_settlements (seller_payout → bank_settlement).
// Não altera bank_transactions nem bank_ledger.

import { runQueryWithTenant, pool } from '@core/database/pool';

export type BankSettlementStatus = 'pending' | 'processing' | 'sent' | 'failed';

export interface BankSettlement {
  id: string;
  tenantId: string;
  payoutId: string;
  amountCents: number;
  currency: string;
  status: BankSettlementStatus;
  createdAt: string;
  processedAt: string | null;
}

interface BankSettlementRow {
  id: string;
  tenant_id: string;
  payout_id: string;
  amount_cents: string;
  currency: string;
  status: string;
  created_at: Date;
  processed_at: Date | null;
}

function toSettlement(row: BankSettlementRow): BankSettlement {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    payoutId: row.payout_id,
    amountCents: parseInt(String(row.amount_cents), 10),
    currency: row.currency,
    status: row.status as BankSettlementStatus,
    createdAt: row.created_at.toISOString(),
    processedAt: row.processed_at ? row.processed_at.toISOString() : null,
  };
}

export interface CreateBankSettlementInput {
  payoutId: string;
  amountCents: number;
  currency: string;
}

export async function createBankSettlement(
  tenantId: string,
  input: CreateBankSettlementInput
): Promise<BankSettlement> {
  const row = await runQueryWithTenant<BankSettlementRow>(
    tenantId,
    `INSERT INTO bank_settlements (tenant_id, payout_id, amount_cents, currency, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id, tenant_id, payout_id, amount_cents, currency, status, created_at, processed_at`,
    [tenantId, input.payoutId, input.amountCents, input.currency]
  );
  if (!row) throw new Error('createBankSettlement: insert failed');
  return toSettlement(row);
}

/**
 * Lista bank_settlements com status = 'pending' (cross-tenant). Usado pelo Bank Settlement Worker.
 */
export async function listPendingSettlements(limit: number): Promise<BankSettlement[]> {
  const result = await pool.query(
    `SELECT id, tenant_id, payout_id, amount_cents, currency, status, created_at, processed_at
     FROM bank_settlements
     WHERE status = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    ['pending', limit]
  );
  const rows = result.rows as BankSettlementRow[];
  return rows.map(toSettlement);
}

/**
 * Lista settlements em `processing` para um tenant (runbook / observabilidade manual).
 * Não altera estado.
 */
export async function listProcessingSettlements(tenantId: string): Promise<BankSettlement[]> {
  const result = await pool.query(
    `SELECT id, tenant_id, payout_id, amount_cents, currency, status, created_at, processed_at
     FROM bank_settlements
     WHERE tenant_id = $1 AND status = $2
     ORDER BY created_at ASC`,
    [tenantId, 'processing']
  );
  const rows = result.rows as BankSettlementRow[];
  return rows.map(toSettlement);
}

/**
 * Obtém um settlement por id (cross-tenant). Usado em reprocessamento manual seguro.
 */
export async function getBankSettlementById(settlementId: string): Promise<BankSettlement | null> {
  const result = await pool.query(
    `SELECT id, tenant_id, payout_id, amount_cents, currency, status, created_at, processed_at
     FROM bank_settlements
     WHERE id = $1
     LIMIT 1`,
    [settlementId]
  );
  const row = result.rows[0] as BankSettlementRow | undefined;
  return row ? toSettlement(row) : null;
}

export async function updateSettlementStatus(
  tenantId: string,
  settlementId: string,
  status: BankSettlementStatus
): Promise<BankSettlement> {
  const row = await runQueryWithTenant<BankSettlementRow>(
    tenantId,
    `UPDATE bank_settlements
     SET status = $3, processed_at = CASE WHEN $3 IN ('sent', 'failed') THEN now() ELSE processed_at END
     WHERE tenant_id = $1 AND id = $2
     RETURNING id, tenant_id, payout_id, amount_cents, currency, status, created_at, processed_at`,
    [tenantId, settlementId, status]
  );
  if (!row) throw new Error('updateSettlementStatus: settlement not found');
  return toSettlement(row);
}