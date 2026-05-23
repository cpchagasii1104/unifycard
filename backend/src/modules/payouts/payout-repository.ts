// Payout Request Repository — tabela payout_requests (seller_available → seller_payout).
// Não altera bank_transactions nem bank_ledger.

import { runQueryWithTenant, pool } from '@core/database/pool';
import { checkRateLimit } from '@modules/rate-limit/financial-rate-limit-guard';
import { checkCircuitBreaker } from '@modules/circuit-breaker/financial-circuit-breaker-guard';

export type PayoutRequestStatus = 'requested' | 'processing' | 'completed' | 'failed';

export interface PayoutRequest {
  id: string;
  tenantId: string;
  actorId: string;
  amountCents: number;
  currency: string;
  status: PayoutRequestStatus;
  createdAt: string;
  processedAt: string | null;
}

interface PayoutRequestRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  amount_cents: string;
  currency: string;
  status: string;
  created_at: Date;
  processed_at: Date | null;
}

function toRequest(row: PayoutRequestRow): PayoutRequest {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    actorId: row.actor_id,
    amountCents: parseInt(String(row.amount_cents), 10),
    currency: row.currency,
    status: row.status as PayoutRequestStatus,
    createdAt: row.created_at.toISOString(),
    processedAt: row.processed_at ? row.processed_at.toISOString() : null,
  };
}

export interface CreatePayoutRequestInput {
  actorId: string;
  amountCents: number;
  currency: string;
}

export async function createPayoutRequest(
  tenantId: string,
  input: CreatePayoutRequestInput
): Promise<PayoutRequest> {
  await checkCircuitBreaker(tenantId, 'payouts');
  await checkRateLimit(tenantId, input.actorId, 'payout_request');
  const row = await runQueryWithTenant<PayoutRequestRow>(
    tenantId,
    `INSERT INTO payout_requests (tenant_id, actor_id, amount_cents, currency, status)
     VALUES ($1, $2, $3, $4, 'requested')
     RETURNING id, tenant_id, actor_id, amount_cents, currency, status, created_at, processed_at`,
    [tenantId, input.actorId, input.amountCents, input.currency]
  );
  if (!row) throw new Error('createPayoutRequest: insert failed');
  return toRequest(row);
}

/**
 * Lista payout_requests com status = 'requested' (cross-tenant). Usado pelo Payout Worker.
 */
export async function listRequestedPayouts(limit: number): Promise<PayoutRequest[]> {
  const result = await pool.query(
    `SELECT id, tenant_id, actor_id, amount_cents, currency, status, created_at, processed_at
     FROM payout_requests
     WHERE status = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    ['requested', limit]
  );
  const rows = result.rows as PayoutRequestRow[];
  return rows.map(toRequest);
}

/**
 * Captura atômica de payout_requests requested: FOR UPDATE SKIP LOCKED + marca processing.
 * Apenas um worker pode processar cada registro. Anti-duplicação.
 */
export async function claimNextRequestedPayouts(limit: number): Promise<PayoutRequest[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query<PayoutRequestRow>(
      `UPDATE payout_requests SET status = 'processing'
       WHERE id IN (
         SELECT id FROM payout_requests
         WHERE status = 'requested'
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, tenant_id, actor_id, amount_cents, currency, status, created_at, processed_at`,
      [limit]
    );
    await client.query('COMMIT');
    return result.rows.map(toRequest);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function updatePayoutStatus(
  tenantId: string,
  payoutId: string,
  status: PayoutRequestStatus
): Promise<PayoutRequest> {
  const processedAt = status === 'completed' || status === 'failed' ? 'now()' : 'processed_at';
  const row = await runQueryWithTenant<PayoutRequestRow>(
    tenantId,
    `UPDATE payout_requests
     SET status = $3, processed_at = CASE WHEN $3 IN ('completed', 'failed') THEN now() ELSE processed_at END
     WHERE tenant_id = $1 AND id = $2
     RETURNING id, tenant_id, actor_id, amount_cents, currency, status, created_at, processed_at`,
    [tenantId, payoutId, status]
  );
  if (!row) throw new Error('updatePayoutStatus: payout request not found');
  return toRequest(row);
}