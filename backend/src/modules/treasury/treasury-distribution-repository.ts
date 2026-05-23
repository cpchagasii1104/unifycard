// Treasury Distribution Repository — tabela treasury_distributions.
// Não escreve em bank_transactions nem bank_ledger. Processado via governance_financial_actions.

import type { PoolClient } from 'pg';
import { runQueryWithTenant, pool } from '@core/database/pool';

export type TreasuryDistributionStatus = 'pending' | 'processed' | 'failed';

export interface TreasuryDistribution {
  id: string;
  tenantId: string;
  treasuryAccountId: string;
  proposalId: string | null;
  referenceId: string | null;
  amountCents: number;
  distributionType: string;
  status: TreasuryDistributionStatus;
  createdAt: string;
  processedAt: string | null;
}

interface TreasuryDistributionRow {
  id: string;
  tenant_id: string;
  treasury_account_id: string;
  proposal_id: string | null;
  reference_id: string | null;
  amount_cents: string;
  distribution_type: string;
  status: string;
  created_at: Date;
  processed_at: Date | null;
}

function toDistribution(row: TreasuryDistributionRow): TreasuryDistribution {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    treasuryAccountId: row.treasury_account_id,
    proposalId: row.proposal_id,
    referenceId: row.reference_id,
    amountCents: parseInt(String(row.amount_cents), 10),
    distributionType: row.distribution_type,
    status: row.status as TreasuryDistributionStatus,
    createdAt: row.created_at.toISOString(),
    processedAt: row.processed_at ? row.processed_at.toISOString() : null,
  };
}

export interface CreateDistributionInput {
  treasuryAccountId: string;
  proposalId?: string | null;
  referenceId?: string | null;
  amountCents: number;
  distributionType: string;
}

/**
 * Cria uma distribuição com status 'pending'.
 */
export async function createDistribution(
  tenantId: string,
  input: CreateDistributionInput
): Promise<TreasuryDistribution> {
  const row = await runQueryWithTenant<TreasuryDistributionRow>(
    tenantId,
    `INSERT INTO treasury_distributions (tenant_id, treasury_account_id, proposal_id, reference_id, amount_cents, distribution_type, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     RETURNING id, tenant_id, treasury_account_id, proposal_id, reference_id, amount_cents, distribution_type, status, created_at, processed_at`,
    [
      tenantId,
      input.treasuryAccountId,
      input.proposalId ?? null,
      input.referenceId ?? null,
      input.amountCents,
      input.distributionType,
    ]
  );
  if (!row) throw new Error('createDistribution: insert failed');
  return toDistribution(row);
}

/**
 * Cria uma distribuição já com status 'processed' (auditoria; ex.: Treasury Split Engine).
 * Não é processada pelo worker.
 */
export async function createProcessedDistribution(
  tenantId: string,
  input: CreateDistributionInput
): Promise<TreasuryDistribution> {
  const row = await runQueryWithTenant<TreasuryDistributionRow>(
    tenantId,
    `INSERT INTO treasury_distributions (tenant_id, treasury_account_id, proposal_id, reference_id, amount_cents, distribution_type, status, processed_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'processed', now())
     RETURNING id, tenant_id, treasury_account_id, proposal_id, reference_id, amount_cents, distribution_type, status, created_at, processed_at`,
    [
      tenantId,
      input.treasuryAccountId,
      input.proposalId ?? null,
      input.referenceId ?? null,
      input.amountCents,
      input.distributionType,
    ]
  );
  if (!row) throw new Error('createProcessedDistribution: insert failed');
  return toDistribution(row);
}

/**
 * Lista distribuições com status 'pending' (para o worker).
 */
export async function listPendingDistributions(limit = 50): Promise<TreasuryDistribution[]> {
  const result = await pool.query<TreasuryDistributionRow>(
    `SELECT id, tenant_id, treasury_account_id, proposal_id, reference_id, amount_cents, distribution_type, status, created_at, processed_at
     FROM treasury_distributions
     WHERE status = 'pending'
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows.map(toDistribution);
}

/**
 * Captura atômica de distribuições pending: FOR UPDATE SKIP LOCKED na transação do client.
 * Anti-duplicação: apenas um worker processa cada registro.
 */
export async function claimNextPendingDistributions(
  client: PoolClient,
  limit: number
): Promise<TreasuryDistribution[]> {
  const result = await client.query<TreasuryDistributionRow>(
    `SELECT id, tenant_id, treasury_account_id, proposal_id, reference_id, amount_cents, distribution_type, status, created_at, processed_at
     FROM treasury_distributions
     WHERE status = 'pending'
     ORDER BY created_at ASC
     LIMIT $1
     FOR UPDATE SKIP LOCKED`,
    [limit]
  );
  return result.rows.map(toDistribution);
}

/**
 * Marca distribuição como processada (status = 'processed', processed_at = now()).
 */
export async function markDistributionProcessed(
  tenantId: string,
  distributionId: string
): Promise<TreasuryDistribution> {
  const row = await runQueryWithTenant<TreasuryDistributionRow>(
    tenantId,
    `UPDATE treasury_distributions
     SET status = 'processed', processed_at = now()
     WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
     RETURNING id, tenant_id, treasury_account_id, proposal_id, reference_id, amount_cents, distribution_type, status, created_at, processed_at`,
    [distributionId, tenantId]
  );
  if (!row) throw new Error('markDistributionProcessed: distribution not found or not pending');
  return toDistribution(row);
}

/**
 * Marca distribuição como falha (status = 'failed', processed_at = now()).
 */
export async function markDistributionFailed(
  tenantId: string,
  distributionId: string
): Promise<TreasuryDistribution> {
  const row = await runQueryWithTenant<TreasuryDistributionRow>(
    tenantId,
    `UPDATE treasury_distributions
     SET status = 'failed', processed_at = now()
     WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
     RETURNING id, tenant_id, treasury_account_id, proposal_id, reference_id, amount_cents, distribution_type, status, created_at, processed_at`,
    [distributionId, tenantId]
  );
  if (!row) throw new Error('markDistributionFailed: distribution not found or not pending');
  return toDistribution(row);
}