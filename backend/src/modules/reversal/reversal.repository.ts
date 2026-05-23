/**
 * Prompt 51 — Reversal registry (reversals table). Escreve apenas em reversals.
 */

import { pool } from '@core/database/pool';
import { runQueryWithTenant } from '@core/database/pool';

export type ReversalStatus = 'pending' | 'processing' | 'executed' | 'failed';

export interface ReversalRow {
  id: string;
  tenantId: string;
  originalTransactionId: string;
  reversalTransactionId: string | null;
  actorId: string;
  reason: string;
  amountCents: number;
  status: ReversalStatus;
  failureReason: string | null;
  createdAt: string;
  processedAt: string | null;
}

interface ReversalDbRow {
  id: string;
  tenant_id: string;
  original_transaction_id: string;
  reversal_transaction_id: string | null;
  actor_id: string;
  reason: string;
  amount_cents: string;
  status: string;
  failure_reason: string | null;
  created_at: Date;
  processed_at: Date | null;
}

function mapRow(r: ReversalDbRow): ReversalRow {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    originalTransactionId: r.original_transaction_id,
    reversalTransactionId: r.reversal_transaction_id,
    actorId: r.actor_id,
    reason: r.reason,
    amountCents: Number(r.amount_cents),
    status: r.status as ReversalStatus,
    failureReason: r.failure_reason,
    createdAt: r.created_at.toISOString(),
    processedAt: r.processed_at ? r.processed_at.toISOString() : null,
  };
}

export interface CreateReversalRequestInput {
  originalTransactionId: string;
  actorId: string;
  reason: string;
  amountCents: number;
}

export async function createReversalRequest(
  tenantId: string,
  input: CreateReversalRequestInput
): Promise<ReversalRow> {
  const existing = await getByOriginalTransactionId(tenantId, input.originalTransactionId);
  if (existing) {
    if (existing.status === 'executed') throw new Error('REVERSAL_ALREADY_EXECUTED');
    if (existing.status === 'failed') throw new Error('REVERSAL_EXISTS_USE_RETRY');
    throw new Error('REVERSAL_DUPLICATE_PENDING');
  }

  const row = await runQueryWithTenant<ReversalDbRow>(
    tenantId,
    `INSERT INTO reversals (
       tenant_id, original_transaction_id, actor_id, reason, amount_cents, status
     ) VALUES ($1, $2, $3, $4, $5, 'pending')
     RETURNING id, tenant_id, original_transaction_id, reversal_transaction_id, actor_id, reason,
               amount_cents, status, failure_reason, created_at, processed_at`,
    [
      tenantId,
      input.originalTransactionId,
      input.actorId,
      input.reason,
      input.amountCents,
    ]
  );
  if (!row) throw new Error('createReversalRequest failed');
  return mapRow(row);
}

export async function getByOriginalTransactionId(
  tenantId: string,
  originalTransactionId: string
): Promise<ReversalRow | null> {
  const row = await runQueryWithTenant<ReversalDbRow>(
    tenantId,
    `SELECT id, tenant_id, original_transaction_id, reversal_transaction_id, actor_id, reason,
            amount_cents, status, failure_reason, created_at, processed_at
     FROM reversals WHERE tenant_id = $1 AND original_transaction_id = $2 LIMIT 1`,
    [tenantId, originalTransactionId]
  );
  return row ? mapRow(row) : null;
}

export async function getReversalById(tenantId: string, id: string): Promise<ReversalRow | null> {
  const row = await runQueryWithTenant<ReversalDbRow>(
    tenantId,
    `SELECT id, tenant_id, original_transaction_id, reversal_transaction_id, actor_id, reason,
            amount_cents, status, failure_reason, created_at, processed_at
     FROM reversals WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
    [tenantId, id]
  );
  return row ? mapRow(row) : null;
}

/**
 * Atomically claims pending reversals (cross-tenant). Sets status = processing.
 */
export async function claimPendingReversals(limit: number): Promise<ReversalRow[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<ReversalDbRow>(
      `UPDATE reversals SET status = 'processing'
       WHERE id IN (
         SELECT id FROM reversals
         WHERE status = 'pending'
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, tenant_id, original_transaction_id, reversal_transaction_id, actor_id, reason,
                 amount_cents, status, failure_reason, created_at, processed_at`,
      [limit]
    );
    await client.query('COMMIT');
    return result.rows.map(mapRow);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function markProcessing(tenantId: string, id: string): Promise<void> {
  await runQueryWithTenant(
    tenantId,
    `UPDATE reversals SET status = 'processing' WHERE tenant_id = $1 AND id = $2 AND status = 'pending'`,
    [tenantId, id]
  );
}

export async function markExecuted(
  tenantId: string,
  id: string,
  reversalTransactionId: string
): Promise<void> {
  const row = await runQueryWithTenant<{ id: string }>(
    tenantId,
    `UPDATE reversals
     SET status = 'executed', reversal_transaction_id = $3, processed_at = now()
     WHERE tenant_id = $1 AND id = $2 AND status = 'processing'
     RETURNING id`,
    [tenantId, id, reversalTransactionId]
  );
  if (!row) throw new Error('markExecuted: reversal not in processing state');
}

export async function markFailed(
  tenantId: string,
  id: string,
  failureReason: string
): Promise<void> {
  await runQueryWithTenant(
    tenantId,
    `UPDATE reversals
     SET status = 'failed', failure_reason = $3, processed_at = now()
     WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id, failureReason.slice(0, 2000)]
  );
}

/** Volta para pending após falha (para worker ou operador). */
export async function resetFailedToPending(tenantId: string, id: string): Promise<void> {
  await runQueryWithTenant(
    tenantId,
    `UPDATE reversals
     SET status = 'pending', failure_reason = NULL, reversal_transaction_id = NULL, processed_at = NULL
     WHERE tenant_id = $1 AND id = $2 AND status = 'failed'`,
    [tenantId, id]
  );
}