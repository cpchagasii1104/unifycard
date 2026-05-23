// Governance Funding Commitment Repository — tabela governance_funding_commitments.
// Commitment = intenção auditável. NÃO move dinheiro; NÃO representa saldo.

import { runQueryWithTenant, pool } from '@core/database/pool';

export type GovernanceFundingCommitmentStatus =
  | 'pending'
  | 'processing'
  | 'executed'
  | 'failed';

export interface GovernanceFundingCommitment {
  id: string;
  tenantId: string;
  proposalId: string;
  treasuryAccountId: string;
  amountCents: number;
  currency: string;
  projectReference: string | null;
  status: GovernanceFundingCommitmentStatus;
  createdAt: string;
  processedAt: string | null;
}

interface GovernanceFundingCommitmentRow {
  id: string;
  tenant_id: string;
  proposal_id: string;
  treasury_account_id: string;
  amount_cents: string;
  currency: string;
  project_reference: string | null;
  status: string;
  created_at: Date;
  processed_at: Date | null;
}

function toCommitment(row: GovernanceFundingCommitmentRow): GovernanceFundingCommitment {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    proposalId: row.proposal_id,
    treasuryAccountId: row.treasury_account_id,
    amountCents: parseInt(String(row.amount_cents), 10),
    currency: row.currency,
    projectReference: row.project_reference,
    status: row.status as GovernanceFundingCommitmentStatus,
    createdAt: row.created_at.toISOString(),
    processedAt: row.processed_at ? row.processed_at.toISOString() : null,
  };
}

export interface CreateCommitmentInput {
  proposalId: string;
  treasuryAccountId: string;
  amountCents: number;
  currency: string;
  projectReference?: string | null;
}

/**
 * Cria um commitment com status 'pending'. Idempotente por proposal_id.
 */
export async function createCommitment(
  tenantId: string,
  input: CreateCommitmentInput
): Promise<GovernanceFundingCommitment> {
  const row = await runQueryWithTenant<GovernanceFundingCommitmentRow>(
    tenantId,
    `INSERT INTO governance_funding_commitments (tenant_id, proposal_id, treasury_account_id, amount_cents, currency, project_reference, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     ON CONFLICT (proposal_id) DO NOTHING
     RETURNING id, tenant_id, proposal_id, treasury_account_id, amount_cents, currency, project_reference, status, created_at, processed_at`,
    [
      tenantId,
      input.proposalId,
      input.treasuryAccountId,
      input.amountCents,
      input.currency,
      input.projectReference ?? null,
    ]
  );
  if (!row) {
    const existing = await getByProposalId(tenantId, input.proposalId);
    if (existing) return existing;
    throw new Error('createCommitment: insert failed');
  }
  return toCommitment(row);
}

export async function getByProposalId(
  tenantId: string,
  proposalId: string
): Promise<GovernanceFundingCommitment | null> {
  const row = await runQueryWithTenant<GovernanceFundingCommitmentRow>(
    tenantId,
    `SELECT id, tenant_id, proposal_id, treasury_account_id, amount_cents, currency, project_reference, status, created_at, processed_at
     FROM governance_funding_commitments WHERE tenant_id = $1 AND proposal_id = $2`,
    [tenantId, proposalId]
  );
  return row ? toCommitment(row) : null;
}

/**
 * Lista commitments com status 'pending' (para o worker).
 */
export async function listPendingCommitments(
  limit: number = 50
): Promise<GovernanceFundingCommitment[]> {
  const result = await pool.query<GovernanceFundingCommitmentRow>(
    `SELECT id, tenant_id, proposal_id, treasury_account_id, amount_cents, currency, project_reference, status, created_at, processed_at
     FROM governance_funding_commitments
     WHERE status = 'pending'
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows.map(toCommitment);
}

/**
 * Captura atômica de commitments pending: FOR UPDATE SKIP LOCKED + marca processing.
 * Apenas um worker pode processar cada registro. Anti-duplicação.
 */
export async function claimNextPendingCommitments(
  limit: number = 50
): Promise<GovernanceFundingCommitment[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sel = await client.query<GovernanceFundingCommitmentRow>(
      `SELECT id, tenant_id, proposal_id, treasury_account_id, amount_cents, currency, project_reference, status, created_at, processed_at
       FROM governance_funding_commitments
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [limit]
    );
    const rows = sel.rows;
    if (rows.length === 0) {
      await client.query('COMMIT');
      return [];
    }
    const ids = rows.map((r) => r.id);
    await client.query(
      `UPDATE governance_funding_commitments SET status = 'processing' WHERE id = ANY($1::uuid[])`,
      [ids]
    );
    await client.query('COMMIT');
    return rows.map(toCommitment);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function markProcessing(
  tenantId: string,
  commitmentId: string
): Promise<GovernanceFundingCommitment> {
  const row = await runQueryWithTenant<GovernanceFundingCommitmentRow>(
    tenantId,
    `UPDATE governance_funding_commitments SET status = 'processing'
     WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
     RETURNING id, tenant_id, proposal_id, treasury_account_id, amount_cents, currency, project_reference, status, created_at, processed_at`,
    [commitmentId, tenantId]
  );
  if (!row) throw new Error('markProcessing: commitment not found or not pending');
  return toCommitment(row);
}

export async function markExecuted(
  tenantId: string,
  commitmentId: string
): Promise<GovernanceFundingCommitment> {
  const row = await runQueryWithTenant<GovernanceFundingCommitmentRow>(
    tenantId,
    `UPDATE governance_funding_commitments SET status = 'executed', processed_at = now()
     WHERE id = $1 AND tenant_id = $2
     RETURNING id, tenant_id, proposal_id, treasury_account_id, amount_cents, currency, project_reference, status, created_at, processed_at`,
    [commitmentId, tenantId]
  );
  if (!row) throw new Error('markExecuted: commitment not found');
  return toCommitment(row);
}

export async function markFailed(
  tenantId: string,
  commitmentId: string
): Promise<GovernanceFundingCommitment> {
  const row = await runQueryWithTenant<GovernanceFundingCommitmentRow>(
    tenantId,
    `UPDATE governance_funding_commitments SET status = 'failed', processed_at = now()
     WHERE id = $1 AND tenant_id = $2
     RETURNING id, tenant_id, proposal_id, treasury_account_id, amount_cents, currency, project_reference, status, created_at, processed_at`,
    [commitmentId, tenantId]
  );
  if (!row) throw new Error('markFailed: commitment not found');
  return toCommitment(row);
}