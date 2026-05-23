// Ledger Snapshot Repository — tabela ledger_snapshots (snapshots de saldo por conta).
// Não altera bank_transactions nem bank_ledger. Somente leitura do ledger + escrita em ledger_snapshots.

import { runQueryWithTenant, pool } from '@core/database/pool';

export interface LedgerSnapshot {
  id: string;
  tenantId: string;
  accountId: string;
  balanceCents: number;
  snapshotAt: string;
  createdAt: string;
}

interface LedgerSnapshotRow {
  id: string;
  tenant_id: string;
  account_id: string;
  balance_cents: string;
  snapshot_at: Date;
  created_at: Date;
}

function toSnapshot(row: LedgerSnapshotRow): LedgerSnapshot {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    accountId: row.account_id,
    balanceCents: parseInt(String(row.balance_cents), 10),
    snapshotAt: row.snapshot_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Registra um snapshot de saldo para uma conta.
 */
export async function recordSnapshot(
  tenantId: string,
  accountId: string,
  balanceCents: number,
  snapshotAt: Date
): Promise<LedgerSnapshot> {
  const row = await runQueryWithTenant<LedgerSnapshotRow>(
    tenantId,
    `INSERT INTO ledger_snapshots (tenant_id, account_id, balance_cents, snapshot_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, tenant_id, account_id, balance_cents, snapshot_at, created_at`,
    [tenantId, accountId, balanceCents, snapshotAt]
  );
  if (!row) throw new Error('recordSnapshot: insert failed');
  return toSnapshot(row);
}

/**
 * Retorna o snapshot mais recente (por snapshot_at). Opcionalmente por tenant.
 */
export async function getLatestSnapshot(
  tenantId?: string
): Promise<LedgerSnapshot | null> {
  const query =
    tenantId === undefined
      ? `SELECT id, tenant_id, account_id, balance_cents, snapshot_at, created_at
         FROM ledger_snapshots
         ORDER BY snapshot_at DESC
         LIMIT 1`
      : `SELECT id, tenant_id, account_id, balance_cents, snapshot_at, created_at
         FROM ledger_snapshots
         WHERE tenant_id = $1
         ORDER BY snapshot_at DESC
         LIMIT 1`;
  const result = await pool.query<LedgerSnapshotRow>(
    query,
    tenantId === undefined ? [] : [tenantId]
  );
  if (result.rows.length === 0) return null;
  return toSnapshot(result.rows[0]);
}

/**
 * Lista snapshots (por tenant e/ou account, mais recentes primeiro).
 */
export async function listSnapshots(options?: {
  tenantId?: string;
  accountId?: string;
  limit?: number;
}): Promise<LedgerSnapshot[]> {
  const limit = options?.limit ?? 100;
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (options?.tenantId) {
    conditions.push(`tenant_id = $${idx++}`);
    values.push(options.tenantId);
  }
  if (options?.accountId) {
    conditions.push(`account_id = $${idx++}`);
    values.push(options.accountId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(limit);
  const result = await pool.query<LedgerSnapshotRow>(
    `SELECT id, tenant_id, account_id, balance_cents, snapshot_at, created_at
     FROM ledger_snapshots
     ${where}
     ORDER BY snapshot_at DESC
     LIMIT $${idx}`,
    values
  );
  return result.rows.map(toSnapshot);
}