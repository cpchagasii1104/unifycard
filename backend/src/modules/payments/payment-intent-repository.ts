// Payment Intent Repository — CRUD para payment_intents.
// Não altera bank_transactions nem bank_ledger.

import type { PoolClient } from 'pg';
import { runQueryWithTenant, runQueriesWithTenant, pool } from '@core/database/pool';
import { checkRateLimit } from '@modules/rate-limit/financial-rate-limit-guard';

/**
 * Status lógico do Payment Intent — espelho do CHECK constraint da tabela payment_intents.
 * Vocabulário canônico definido em 07_NOMENCLATURA_CANONICA §4.11 e materializado pela migration
 * 20260530503000_payment_intents_normalize_status (mapping legado: 'CREATED'→'pending', 'completed'→'settled').
 */
export type PaymentIntentStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'escrowed'
  | 'settled'
  | 'failed'
  | 'cancelled'
  | 'reversed'
  | 'partially_refunded'
  | 'disputed'
  | 'expired';

export interface PaymentIntent {
  id: string;
  tenantId: string;
  referenceId: string;
  gateway: string;
  actorId: string | null;
  amountCents: number;
  currency: string;
  status: PaymentIntentStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface PaymentIntentRow {
  id: string;
  tenant_id: string;
  reference_id: string;
  gateway: string;
  actor_id: string | null;
  amount_cents: string;
  currency: string;
  status: string;
  metadata: Record<string, unknown>;
  source?: string | null;
  intent_type: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePaymentIntentInput {
  referenceId: string;
  gateway: string;
  actorId?: string | null;
  amountCents: number;
  currency: string;
  status?: PaymentIntentStatus;
  metadata?: Record<string, unknown>;
  source?: string; // OPCIONAL — origem do fluxo de negócio
  intentType?: string; // default: 'payment'
}

function toIntent(row: PaymentIntentRow): PaymentIntent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    referenceId: row.reference_id,
    gateway: row.gateway,
    actorId: row.actor_id,
    amountCents: parseInt(String(row.amount_cents), 10),
    currency: row.currency,
    status: ((row as any).payment_status ?? row.status) as PaymentIntentStatus,
    metadata: row.metadata || {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function createPaymentIntent(
  tenantId: string,
  input: CreatePaymentIntentInput
): Promise<PaymentIntent> {
  await checkRateLimit(tenantId, input.actorId ?? tenantId, 'payment_attempt');
  const status = input.status ?? 'pending';
  const row = await runQueryWithTenant<PaymentIntentRow>(
    tenantId,
    `INSERT INTO payment_intents (
       tenant_id, reference_id, gateway, actor_id, amount_cents, currency, payment_status, metadata, source, intent_type
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
     RETURNING id, tenant_id, reference_id, gateway, actor_id, amount_cents, currency, payment_status, metadata, source, intent_type, created_at, updated_at`,
    [
      tenantId,
      input.referenceId,
      input.gateway,
      input.actorId ?? null,
      input.amountCents,
      input.currency,
      status,
      JSON.stringify(input.metadata ?? {}),
      input.source ?? null,
      input.intentType ?? 'payment',
    ]
  );
  if (!row) throw new Error('createPaymentIntent: insert failed');
  return toIntent(row);
}

export async function getPaymentIntentByReference(
  tenantId: string,
  referenceId: string
): Promise<PaymentIntent | null> {
  const row = await runQueryWithTenant<PaymentIntentRow>(
    tenantId,
    `SELECT id, tenant_id, reference_id, gateway, actor_id, amount_cents, currency, payment_status, metadata, created_at, updated_at
     FROM payment_intents
     WHERE tenant_id = $1 AND reference_id = $2`,
    [tenantId, referenceId]
  );
  return row ? toIntent(row) : null;
}

export async function updatePaymentIntentStatus(
  tenantId: string,
  intentId: string,
  status: PaymentIntentStatus
): Promise<PaymentIntent> {
  const row = await runQueryWithTenant<PaymentIntentRow>(
    tenantId,
    `UPDATE payment_intents
     SET payment_status = $3, updated_at = now()
     WHERE tenant_id = $1 AND id = $2
     RETURNING id, tenant_id, reference_id, gateway, actor_id, amount_cents, currency, payment_status, metadata, created_at, updated_at`,
    [tenantId, intentId, status]
  );
  if (!row) throw new Error('updatePaymentIntentStatus: intent not found');
  return toIntent(row);
}

export async function updatePaymentIntentMetadata(
  tenantId: string,
  intentId: string,
  metadata: Record<string, unknown>
): Promise<PaymentIntent> {
  const row = await runQueryWithTenant<PaymentIntentRow>(
    tenantId,
    `UPDATE payment_intents
     SET metadata = metadata || $3::jsonb, updated_at = now()
     WHERE tenant_id = $1 AND id = $2
     RETURNING id, tenant_id, reference_id, gateway, actor_id, amount_cents, currency, payment_status, metadata, created_at, updated_at`,
    [tenantId, intentId, JSON.stringify(metadata)]
  );
  if (!row) throw new Error('updatePaymentIntentMetadata: intent not found');
  return toIntent(row);
}

/**
 * Lista PaymentIntents com status escrowed (cross-tenant). Usado pelo Settlement Worker.
 */
export async function listEscrowedPaymentIntents(limit: number): Promise<PaymentIntent[]> {
  const result = await pool.query(
    `SELECT id, tenant_id, reference_id, gateway, actor_id, amount_cents, currency, payment_status, metadata, created_at, updated_at
     FROM payment_intents
     WHERE payment_status = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    ['escrowed', limit]
  );
  const rows = result.rows as PaymentIntentRow[];
  return rows.map(toIntent);
}

/**
 * Captura atômica de PaymentIntents escrowed: FOR UPDATE SKIP LOCKED na transação do client.
 * Usado pelo Settlement Worker para evitar que dois workers processem o mesmo intent.
 */
export async function claimEscrowedPaymentIntents(
  client: PoolClient,
  limit: number
): Promise<PaymentIntent[]> {
  const result = await client.query<PaymentIntentRow>(
    `SELECT id, tenant_id, reference_id, gateway, actor_id, amount_cents, currency, payment_status, metadata, created_at, updated_at
     FROM payment_intents
     WHERE payment_status = $1
     ORDER BY created_at ASC
     LIMIT $2
     FOR UPDATE SKIP LOCKED`,
    ['escrowed', limit]
  );
  return result.rows.map(toIntent);
}

/**
 * Lista PaymentIntents com status settled (cross-tenant). Usado pelo Release Worker.
 */
export async function listSettledPaymentIntents(limit: number): Promise<PaymentIntent[]> {
  const result = await pool.query(
    `SELECT id, tenant_id, reference_id, gateway, actor_id, amount_cents, currency, payment_status, metadata, created_at, updated_at
     FROM payment_intents
     WHERE payment_status = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    ['settled', limit]
  );
  const rows = result.rows as PaymentIntentRow[];
  return rows.map(toIntent);
}

/**
 * Captura atômica de PaymentIntents settled: FOR UPDATE SKIP LOCKED na transação do client.
 * Usado pelo Release Worker para evitar que dois workers processem o mesmo intent.
 */
export async function claimSettledPaymentIntents(
  client: PoolClient,
  limit: number
): Promise<PaymentIntent[]> {
  const result = await client.query<PaymentIntentRow>(
    `SELECT id, tenant_id, reference_id, gateway, actor_id, amount_cents, currency, payment_status, metadata, created_at, updated_at
     FROM payment_intents
     WHERE payment_status = $1
     ORDER BY created_at ASC
     LIMIT $2
     FOR UPDATE SKIP LOCKED`,
    ['settled', limit]
  );
  return result.rows.map(toIntent);
}

/**
 * Lista PaymentIntents por order_id. Usado pelo CRM e outros fluxos de consulta.
 */
export async function listPaymentIntentsByOrder(
  tenantId: string,
  orderId: string
): Promise<PaymentIntent[]> {
  const rows = await runQueriesWithTenant<PaymentIntentRow>(
    tenantId,
    `SELECT id, tenant_id, reference_id, gateway, actor_id, amount_cents, currency,
            payment_status, metadata, source, intent_type, created_at, updated_at
     FROM payment_intents
     WHERE tenant_id = $1
       AND order_id = $2
     ORDER BY created_at DESC`,
    [tenantId, orderId]
  );
  return rows.map(toIntent);
}