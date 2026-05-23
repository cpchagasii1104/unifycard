// Governance Funding Repository — tabela governance_funding.
// Não escreve em bank_transactions nem bank_ledger.

import { runQueryWithTenant, pool } from '@core/database/pool';

export type GovernanceFundingStatus = 'pending' | 'processing' | 'funded' | 'failed';

export interface GovernanceFunding {
  id: string;
  tenantId: string;
  proposalId: string;
  treasuryAccountId: string;
  projectReference: string | null;
  amountCents: number;
  currency: string;
  status: GovernanceFundingStatus;
  createdAt: string;
  processedAt: string | null;
}

interface GovernanceFundingRow {
  id: string;
  tenant_id: string;
  proposal_id: string;
  treasury_account_id: string;
  project_reference: string | null;
  amount_cents: string;
  currency: string;
  status: string;
  created_at: Date;
  processed_at: Date | null;
}

function toFunding(row: GovernanceFundingRow): GovernanceFunding {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    proposalId: row.proposal_id,
    treasuryAccountId: row.treasury_account_id,
    projectReference: row.project_reference,
    amountCents: parseInt(String(row.amount_cents), 10),
    currency: row.currency,
    status: row.status as GovernanceFundingStatus,
    createdAt: row.created_at.toISOString(),
    processedAt: row.processed_at ? row.processed_at.toISOString() : null,
  };
}

export interface CreateFundingRequestInput {
  proposalId: string;
  treasuryAccountId: string;
  projectReference?: string | null;
  amountCents: number;
  currency: string;
}

/**
 * Cria um pedido de financiamento com status 'pending'.
 * Idempotente por proposal_id (ON CONFLICT DO NOTHING ou verificação prévia).
 */
export async function createFundingRequest(
  tenantId: string,
  input: CreateFundingRequestInput
): Promise<GovernanceFunding> {
  const row = await runQueryWithTenant<GovernanceFundingRow>(
    tenantId,
    `INSERT INTO governance_funding (tenant_id, proposal_id, treasury_account_id, project_reference, amount_cents, currency, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     ON CONFLICT (proposal_id) DO NOTHING
     RETURNING id, tenant_id, proposal_id, treasury_account_id, project_reference, amount_cents, currency, status, created_at, processed_at`,
    [
      tenantId,
      input.proposalId,
      input.treasuryAccountId,
      input.projectReference ?? null,
      input.amountCents,
      input.currency,
    ]
  );
  if (!row) {
    const existing = await getFundingByProposalId(tenantId, input.proposalId);
    if (existing) return existing;
    throw new Error('createFundingRequest: insert failed');
  }
  return toFunding(row);
}

export async function getFundingByProposalId(
  tenantId: string,
  proposalId: string
): Promise<GovernanceFunding | null> {
  const row = await runQueryWithTenant<GovernanceFundingRow>(
    tenantId,
    `SELECT id, tenant_id, proposal_id, treasury_account_id, project_reference, amount_cents, currency, status, created_at, processed_at
     FROM governance_funding WHERE tenant_id = $1 AND proposal_id = $2`,
    [tenantId, proposalId]
  );
  return row ? toFunding(row) : null;
}

/**
 * Lista pedidos com status 'pending' (para o worker).
 */
export async function listPendingFundingRequests(limit = 50): Promise<GovernanceFunding[]> {
  const result = await pool.query<GovernanceFundingRow>(
    `SELECT id, tenant_id, proposal_id, treasury_account_id, project_reference, amount_cents, currency, status, created_at, processed_at
     FROM governance_funding
     WHERE status = 'pending'
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows.map(toFunding);
}

/**
 * Captura atômica de funding requests pending: FOR UPDATE SKIP LOCKED + marca processing.
 * Apenas um worker pode processar cada registro. Anti-duplicação.
 */
export async function claimNextPendingFundingRequests(limit = 50): Promise<GovernanceFunding[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<GovernanceFundingRow>(
      `UPDATE governance_funding SET status = 'processing'
       WHERE id IN (
         SELECT id FROM governance_funding
         WHERE status = 'pending'
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, tenant_id, proposal_id, treasury_account_id, project_reference, amount_cents, currency, status, created_at, processed_at`,
      [limit]
    );
    await client.query('COMMIT');
    return result.rows.map(toFunding);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function markFundingProcessing(
  tenantId: string,
  fundingId: string
): Promise<GovernanceFunding> {
  const row = await runQueryWithTenant<GovernanceFundingRow>(
    tenantId,
    `UPDATE governance_funding SET status = 'processing' WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
     RETURNING id, tenant_id, proposal_id, treasury_account_id, project_reference, amount_cents, currency, status, created_at, processed_at`,
    [fundingId, tenantId]
  );
  if (!row) throw new Error('markFundingProcessing: funding not found or not pending');
  return toFunding(row);
}

export async function markFundingFunded(
  tenantId: string,
  fundingId: string
): Promise<GovernanceFunding> {
  const row = await runQueryWithTenant<GovernanceFundingRow>(
    tenantId,
    `UPDATE governance_funding SET status = 'funded', processed_at = now() WHERE id = $1 AND tenant_id = $2
     RETURNING id, tenant_id, proposal_id, treasury_account_id, project_reference, amount_cents, currency, status, created_at, processed_at`,
    [fundingId, tenantId]
  );
  if (!row) throw new Error('markFundingFunded: funding not found');
  return toFunding(row);
}

export async function markFundingFailed(
  tenantId: string,
  fundingId: string
): Promise<GovernanceFunding> {
  const row = await runQueryWithTenant<GovernanceFundingRow>(
    tenantId,
    `UPDATE governance_funding SET status = 'failed', processed_at = now() WHERE id = $1 AND tenant_id = $2
     RETURNING id, tenant_id, proposal_id, treasury_account_id, project_reference, amount_cents, currency, status, created_at, processed_at`,
    [fundingId, tenantId]
  );
  if (!row) throw new Error('markFundingFailed: funding not found');
  return toFunding(row);
}