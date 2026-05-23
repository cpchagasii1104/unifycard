// Treasury Account Repository — tabela treasury_accounts (contas institucionais).
// Não escreve em bank_transactions nem bank_ledger. Apenas registra vínculo com bank_accounts.

import { runQueryWithTenant, pool } from '@core/database/pool';

export interface TreasuryAccount {
  id: string;
  tenantId: string;
  treasuryType: string;
  accountId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface TreasuryAccountRow {
  id: string;
  tenant_id: string;
  treasury_type: string;
  account_id: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

function toTreasuryAccount(row: TreasuryAccountRow): TreasuryAccount {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    treasuryType: row.treasury_type,
    accountId: row.account_id,
    metadata: row.metadata || {},
    createdAt: row.created_at.toISOString(),
  };
}

export interface CreateTreasuryAccountInput {
  treasuryType: string;
  accountId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Cria um registro de conta de tesouraria (vincula treasury_type a um bank_account existente).
 */
export async function createTreasuryAccount(
  tenantId: string,
  input: CreateTreasuryAccountInput
): Promise<TreasuryAccount> {
  const row = await runQueryWithTenant<TreasuryAccountRow>(
    tenantId,
    `INSERT INTO treasury_accounts (tenant_id, treasury_type, account_id, metadata)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id, tenant_id, treasury_type, account_id, metadata, created_at`,
    [tenantId, input.treasuryType, input.accountId, JSON.stringify(input.metadata ?? {})]
  );
  if (!row) throw new Error('createTreasuryAccount: insert failed');
  return toTreasuryAccount(row);
}

/**
 * Busca uma conta de tesouraria por id (escopo do tenant).
 */
export async function getTreasuryAccount(
  tenantId: string,
  id: string
): Promise<TreasuryAccount | null> {
  const row = await runQueryWithTenant<TreasuryAccountRow>(
    tenantId,
    `SELECT id, tenant_id, treasury_type, account_id, metadata, created_at
     FROM treasury_accounts
     WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id]
  );
  return row ? toTreasuryAccount(row) : null;
}

/**
 * Lista contas de tesouraria. Opcionalmente por tenant.
 */
export async function listTreasuryAccounts(
  tenantId?: string
): Promise<TreasuryAccount[]> {
  const query =
    tenantId === undefined
      ? `SELECT id, tenant_id, treasury_type, account_id, metadata, created_at
         FROM treasury_accounts ORDER BY created_at DESC`
      : `SELECT id, tenant_id, treasury_type, account_id, metadata, created_at
         FROM treasury_accounts WHERE tenant_id = $1 ORDER BY created_at DESC`;
  const result = await pool.query<TreasuryAccountRow>(
    query,
    tenantId === undefined ? [] : [tenantId]
  );
  return result.rows.map(toTreasuryAccount);
}