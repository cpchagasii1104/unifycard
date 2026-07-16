/**
 * Prompt 51 — Reversal registry (reversals table). Escreve apenas em reversals.
 */

import type { PoolClient } from 'pg';
import { pool } from '@core/database/pool';
import { runQueryWithTenant } from '@core/database/pool';

// FISCAL-4E (PASSE 3R): executa uma query de 1 linha OU na transação DONA do chamador (existingClient
// fornecido → mesma tx, sem novo client/BEGIN/COMMIT) OU no caminho legado (runQueryWithTenant, conexão
// própria). Preserva byte-a-byte o comportamento legado quando `client` é ausente.
async function queryOneRow<T>(
  tenantId: string,
  client: PoolClient | undefined,
  sql: string,
  params: any[]
): Promise<T | undefined> {
  if (client) {
    const r = await client.query<T>(sql, params);
    return r.rows[0] ?? undefined;
  }
  return runQueryWithTenant<T>(tenantId, sql, params);
}

export type ReversalStatus = 'pending' | 'processing' | 'executed' | 'failed';

/**
 * Taxonomia canônica de estorno (DECISION-0052 / CORE_ESTORNOS_FINANCEIROS_CANONICO §1.1).
 *
 * - external_reversal: gateway externo iniciou (sistêmico, sem usuário humano).
 * - internal_refund: operador humano da plataforma decidiu refund (EXIGE
 *   performed_by_user_id; aprovação via Bloco C é frente futura).
 * - chargeback_open / chargeback_lost / chargeback_reversed: estados de
 *   disputa externa (todos sistêmicos).
 */
export type ReversalType =
  | 'external_reversal'
  | 'internal_refund'
  | 'chargeback_open'
  | 'chargeback_lost'
  | 'chargeback_reversed';

/**
 * Fonte canônica da autoridade que disparou a reversão (DECISION-0052).
 *
 * NULL aceito enquanto callers legados não declaram (compat).
 */
export type ReversalAuthoritySource = 'system' | 'ownership' | 'delegation' | 'account_acl';

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
  /** DECISION-0052: taxonomia canônica. */
  reversalType: ReversalType;
  /** DECISION-0052: NULL para sistêmicos; NOT NULL para internal_refund. */
  performedByUserId: string | null;
  /** DECISION-0052: fonte da autoridade. */
  authoritySource: ReversalAuthoritySource | null;
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
  reversal_type: string;
  performed_by_user_id: string | null;
  authority_source: string | null;
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
    reversalType: r.reversal_type as ReversalType,
    performedByUserId: r.performed_by_user_id,
    authoritySource: r.authority_source as ReversalAuthoritySource | null,
  };
}

const REVERSAL_SELECT_COLUMNS = `
  id, tenant_id, original_transaction_id, reversal_transaction_id, actor_id, reason,
  amount_cents, status, failure_reason, created_at, processed_at,
  reversal_type, performed_by_user_id, authority_source
`;

export interface CreateReversalRequestInput {
  originalTransactionId: string;
  actorId: string;
  reason: string;
  amountCents: number;
  /** DECISION-0052: obrigatório. Default 'external_reversal' nos callers
   *  sistêmicos (bank-integration, reconciliation-dispute, worker). */
  reversalType: ReversalType;
  /** DECISION-0052: obrigatório quando reversalType='internal_refund'
   *  (CHECK Postgres enforça). NULL para sistêmicos. */
  performedByUserId?: string | null;
  /** DECISION-0052: opcional; declarado pelo caller conforme contexto. */
  authoritySource?: ReversalAuthoritySource | null;
}

export async function createReversalRequest(
  tenantId: string,
  input: CreateReversalRequestInput,
  existingClient?: PoolClient
): Promise<ReversalRow> {
  const existing = await getByOriginalTransactionId(tenantId, input.originalTransactionId, existingClient);
  if (existing) {
    if (existing.status === 'executed') throw new Error('REVERSAL_ALREADY_EXECUTED');
    if (existing.status === 'failed') throw new Error('REVERSAL_EXISTS_USE_RETRY');
    throw new Error('REVERSAL_DUPLICATE_PENDING');
  }

  // Defesa runtime: norma §9.1 + CHECK Postgres já enforça, mas dar erro
  // explícito em TS antes de cair no banco produz mensagem melhor.
  if (input.reversalType === 'internal_refund' && !input.performedByUserId) {
    throw new Error(
      'INTERNAL_REFUND_REQUIRES_PERFORMED_BY_USER: ' +
        'reversalType=internal_refund exige performedByUserId (CORE_ESTORNOS §4 + §9.1).'
    );
  }
  if (
    input.reversalType !== 'internal_refund' &&
    input.performedByUserId
  ) {
    throw new Error(
      `SYSTEMIC_REVERSAL_REJECTS_USER: reversalType='${input.reversalType}' é sistêmico ` +
        `(CORE_ESTORNOS §4) — performedByUserId deve ser NULL. ` +
        `Se há humano real, usar reversalType='internal_refund'.`
    );
  }

  const row = await queryOneRow<ReversalDbRow>(
    tenantId,
    existingClient,
    `INSERT INTO reversals (
       tenant_id, original_transaction_id, actor_id, reason, amount_cents, status,
       reversal_type, performed_by_user_id, authority_source
     ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8)
     RETURNING ${REVERSAL_SELECT_COLUMNS}`,
    [
      tenantId,
      input.originalTransactionId,
      input.actorId,
      input.reason,
      input.amountCents,
      input.reversalType,
      input.performedByUserId ?? null,
      input.authoritySource ?? null,
    ]
  );
  if (!row) throw new Error('createReversalRequest failed');
  return mapRow(row);
}

export async function getByOriginalTransactionId(
  tenantId: string,
  originalTransactionId: string,
  existingClient?: PoolClient
): Promise<ReversalRow | null> {
  const row = await queryOneRow<ReversalDbRow>(
    tenantId,
    existingClient,
    `SELECT ${REVERSAL_SELECT_COLUMNS}
     FROM reversals WHERE tenant_id = $1 AND original_transaction_id = $2 LIMIT 1`,
    [tenantId, originalTransactionId]
  );
  return row ? mapRow(row) : null;
}

export async function getReversalById(
  tenantId: string,
  id: string,
  existingClient?: PoolClient
): Promise<ReversalRow | null> {
  const row = await queryOneRow<ReversalDbRow>(
    tenantId,
    existingClient,
    `SELECT ${REVERSAL_SELECT_COLUMNS}
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
       RETURNING ${REVERSAL_SELECT_COLUMNS}`,
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