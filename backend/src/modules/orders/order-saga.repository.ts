import type { PoolClient } from 'pg';
import { pool, runQueryWithTenant } from '@core/database/pool';

export type OrderSagaStatus =
  | 'created'
  | 'payment_pending'
  | 'paid'
  | 'fulfilled'
  | 'failed'
  | 'cancelled';

export type OrderSagaRow = {
  id: string;
  tenant_id: string;
  order_id: string;
  status: OrderSagaStatus | string;
  current_step: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  next_retry_at: Date | null;
  timeout_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function parsePayload(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

function rowToSaga(r: {
  id: string;
  tenant_id: string;
  order_id: string;
  status: string;
  current_step: string;
  payload: unknown;
  metadata: unknown;
  attempts: string | number;
  max_attempts: string | number;
  next_retry_at: Date | null;
  timeout_at: Date | null;
  created_at: Date;
  updated_at: Date;
}): OrderSagaRow {
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    order_id: r.order_id,
    status: r.status,
    current_step: r.current_step,
    payload: parsePayload(r.payload),
    metadata: parsePayload(r.metadata),
    attempts: Number(r.attempts),
    max_attempts: Number(r.max_attempts),
    next_retry_at: r.next_retry_at,
    timeout_at: r.timeout_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

const SAGA_ROW_SELECT = `
  id, tenant_id, order_id, status, current_step, payload, metadata,
  attempts, max_attempts, next_retry_at, timeout_at, created_at, updated_at
`;

export async function getByOrderId(
  tenantId: string,
  orderId: string
): Promise<OrderSagaRow | undefined> {
  const row = await runQueryWithTenant<
    Parameters<typeof rowToSaga>[0] & { payload: unknown; metadata: unknown }
  >(
    tenantId,
    `
    SELECT ${SAGA_ROW_SELECT}
    FROM order_sagas
    WHERE tenant_id = $1::uuid AND order_id = $2::uuid
    `,
    [tenantId, orderId]
  );
  return row ? rowToSaga(row) : undefined;
}

/**
 * Idempotência por (tenant_id, order_id): uma linha por pedido (UNIQUE).
 * @deprecated Preferir orderSagaService no core/sagas para transições canónicas.
 */
export async function upsertState(
  tenantId: string,
  orderId: string,
  status: string,
  metadata: Record<string, unknown>
): Promise<OrderSagaRow> {
  const row = await runQueryWithTenant<Parameters<typeof rowToSaga>[0] & { payload: unknown }>(
    tenantId,
    `
    INSERT INTO order_sagas (tenant_id, order_id, status, metadata, payload, updated_at)
    VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, '{}'::jsonb, NOW())
    ON CONFLICT ON CONSTRAINT order_sagas_tenant_order_uk
    DO UPDATE SET
      status = EXCLUDED.status,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING ${SAGA_ROW_SELECT}
    `,
    [tenantId, orderId, status, JSON.stringify(metadata)]
  );
  if (!row) {
    throw new Error('ORDER_SAGA_UPSERT_EMPTY');
  }
  return rowToSaga(row as Parameters<typeof rowToSaga>[0]);
}

export async function lockSagaForUpdate(
  client: PoolClient,
  tenantId: string,
  orderId: string
): Promise<OrderSagaRow | null> {
  const r = await client.query<Parameters<typeof rowToSaga>[0] & { payload: unknown }>(
    `
    SELECT ${SAGA_ROW_SELECT}
    FROM order_sagas
    WHERE tenant_id = $1::uuid AND order_id = $2::uuid
    FOR UPDATE
    `,
    [tenantId, orderId]
  );
  if (r.rows.length === 0) return null;
  return rowToSaga(r.rows[0]!);
}

export async function insertSaga(
  client: PoolClient,
  tenantId: string,
  orderId: string,
  opts: {
    timeoutAt: Date;
    payload?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
): Promise<OrderSagaRow> {
  const r = await client.query<Parameters<typeof rowToSaga>[0] & { payload: unknown }>(
    `
    INSERT INTO order_sagas (
      tenant_id, order_id, status, current_step, payload, metadata,
      attempts, max_attempts, timeout_at, created_at, updated_at
    )
    VALUES (
      $1::uuid, $2::uuid, 'created', 'order_created',
      $3::jsonb, $4::jsonb, 0, 10, $5, NOW(), NOW()
    )
    RETURNING ${SAGA_ROW_SELECT}
    `,
    [
      tenantId,
      orderId,
      JSON.stringify(opts.payload ?? {}),
      JSON.stringify(opts.metadata ?? {}),
      opts.timeoutAt,
    ]
  );
  return rowToSaga(r.rows[0]!);
}

export async function updateSagaRow(
  client: PoolClient,
  tenantId: string,
  orderId: string,
  fields: {
    status: OrderSagaStatus | string;
    current_step: string;
    attemptsIncrement?: boolean;
    payload?: Record<string, unknown>;
    timeout_at?: Date | null;
    next_retry_at?: Date | null;
  }
): Promise<OrderSagaRow> {
  const setParts: string[] = ['status = $3', 'current_step = $4', 'updated_at = NOW()'];
  const params: unknown[] = [tenantId, orderId, fields.status, fields.current_step];
  let i = 5;
  if (fields.attemptsIncrement) {
    setParts.push('attempts = order_sagas.attempts + 1');
  }
  if (fields.payload !== undefined) {
    setParts.push(`payload = COALESCE(order_sagas.payload, '{}'::jsonb) || $${i}::jsonb`);
    params.push(JSON.stringify(fields.payload));
    i++;
  }
  if (fields.timeout_at !== undefined) {
    setParts.push(`timeout_at = $${i}`);
    params.push(fields.timeout_at);
    i++;
  }
  if (fields.next_retry_at !== undefined) {
    setParts.push(`next_retry_at = $${i}`);
    params.push(fields.next_retry_at);
    i++;
  }

  const r = await client.query<Parameters<typeof rowToSaga>[0] & { payload: unknown }>(
    `
    UPDATE order_sagas
    SET ${setParts.join(', ')}
    WHERE tenant_id = $1::uuid AND order_id = $2::uuid
    RETURNING ${SAGA_ROW_SELECT}
    `,
    params
  );
  if (r.rows.length === 0) {
    throw new Error('ORDER_SAGA_UPDATE_NONE');
  }
  return rowToSaga(r.rows[0]!);
}

/** Sagas com timeout vencido (worker INFRA-4; sem RLS na tabela). */
export async function claimExpiredSagas(limit: number): Promise<OrderSagaRow[]> {
  const r = await pool.query<Parameters<typeof rowToSaga>[0] & { payload: unknown }>(
    `
    SELECT ${SAGA_ROW_SELECT}
    FROM order_sagas
    WHERE timeout_at IS NOT NULL
      AND timeout_at < NOW()
      AND status NOT IN ('fulfilled', 'failed', 'cancelled')
    ORDER BY timeout_at ASC
    LIMIT $1
    `,
    [limit]
  );
  return r.rows.map((x) => rowToSaga(x));
}

export async function sagaCountsByStatus(): Promise<{ status: string; count: string }[]> {
  const r = await pool.query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text AS count FROM order_sagas GROUP BY status ORDER BY status`
  );
  return r.rows;
}

export async function listRecentSagas(limit: number): Promise<OrderSagaRow[]> {
  const r = await pool.query<Parameters<typeof rowToSaga>[0] & { payload: unknown }>(
    `
    SELECT ${SAGA_ROW_SELECT}
    FROM order_sagas
    ORDER BY updated_at DESC
    LIMIT $1
    `,
    [limit]
  );
  return r.rows.map((x) => rowToSaga(x));
}