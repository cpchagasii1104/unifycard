import { pool, runQueryWithTenant } from '@core/database/pool';
import { canonicalLogger } from '@core/logging/canonical-logger';
import { getAuthorityMode } from '../compliance/authority-mode';

export type HandlerFailureStatus = 'pending' | 'retrying' | 'dead';

export type EventHandlerFailureRow = {
  id: string;
  tenant_id: string;
  event_id: string;
  event_type: string;
  handler_key: string;
  attempts: number;
  max_attempts: number;
  next_retry_at: Date;
  status: HandlerFailureStatus;
  last_error: string | null;
};

const DEFAULT_MAX_ATTEMPTS = 10;

/** Segundos até próximo retry após esta falha (attempts = total de falhas após incremento). */
export function handlerFailureBackoffSeconds(attemptsAfterIncrement: number): number {
  const base = 2;
  const maxSec = 3600;
  const exp = Math.min(30, Math.max(0, attemptsAfterIncrement - 1));
  return Math.min(maxSec, base * Math.pow(2, exp));
}

export type UpsertHandlerFailureResult = {
  status: HandlerFailureStatus;
  attempts: number;
};

/**
 * Incrementa falhas de forma persistente (uma linha por tenant+event+handler_key).
 * Primeira falha: INSERT attempts=1; seguintes: attempts+1, dead se >= max_attempts.
 */
export async function upsertHandlerFailure(params: {
  tenantId: string;
  eventId: string;
  eventType: string;
  handlerKey: string;
  errorMessage: string;
  maxAttempts?: number;
}): Promise<UpsertHandlerFailureResult | undefined> {
  const maxAttempts = params.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const msg = params.errorMessage.slice(0, 8000);

  try {
    const r = await pool.query<{ status: HandlerFailureStatus; attempts: string }>(
      `
      INSERT INTO event_handler_failures (
        tenant_id, event_id, event_type, handler_key,
        attempts, max_attempts, next_retry_at, status, last_error, updated_at
      )
      VALUES (
        $1::uuid, $2::uuid, $3, $4,
        1, $5,
        CASE
          WHEN 1 >= $5 THEN NOW()
          ELSE NOW() + (
            LEAST(
              3600::double precision,
              2::double precision * POW(2::double precision, LEAST(30, GREATEST(0, 0))::double precision)
            ) * INTERVAL '1 second'
          )
        END,
        CASE WHEN 1 >= $5 THEN 'dead' ELSE 'pending' END,
        $6, NOW()
      )
      ON CONFLICT (tenant_id, event_id, handler_key)
      DO UPDATE SET
        attempts = event_handler_failures.attempts + 1,
        last_error = EXCLUDED.last_error,
        event_type = EXCLUDED.event_type,
        updated_at = NOW(),
        status = CASE
          WHEN event_handler_failures.attempts + 1 >= event_handler_failures.max_attempts THEN 'dead'
          ELSE 'pending'
        END,
        next_retry_at = CASE
          WHEN event_handler_failures.attempts + 1 >= event_handler_failures.max_attempts
            THEN event_handler_failures.next_retry_at
          ELSE NOW() + (
            LEAST(
              3600::double precision,
              2::double precision * POW(
                2::double precision,
                LEAST(30, GREATEST(0, event_handler_failures.attempts))::double precision
              )
            ) * INTERVAL '1 second'
          )
        END
      RETURNING status, attempts
      `,
      [params.tenantId, params.eventId, params.eventType, params.handlerKey, maxAttempts, msg]
    );
    const row = r.rows[0];
    if (!row) return undefined;
    const attempts = Number(row.attempts);
    if (row.status === 'dead') {
      canonicalLogger.error(null, 'handler_dead_letter', {
        metric_event: 'handler_dead_letter',
        tenantId: params.tenantId,
        eventId: params.eventId,
        eventType: params.eventType,
        handlerKey: params.handlerKey,
        attempts,
      });
    }
    return { status: row.status, attempts };
  } catch (e) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code?: string }).code : undefined;
    if (code === '42P01') {
      if (getAuthorityMode() === 'strict') {
        console.error('[event-handler-failure] CRITICAL: tabela ausente (42P01) em strict mode — investigar infraestrutura');
        throw e;
      }
      console.error('[event-handler-failure] 42P01: tabela ausente (permissive mode)');
      return undefined;
    }
    throw e;
  }
}

export async function deleteHandlerFailure(id: string): Promise<void> {
  try {
    await pool.query(`DELETE FROM event_handler_failures WHERE id = $1::uuid`, [id]);
  } catch (e) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code?: string }).code : undefined;
    if (code === '42P01') {
      if (getAuthorityMode() === 'strict') {
        console.error('[event-handler-failure] CRITICAL: tabela ausente (42P01) em strict mode — investigar infraestrutura');
        throw e;
      }
      console.error('[event-handler-failure] 42P01: tabela ausente (permissive mode)');
      return;
    }
    throw e;
  }
}

/** Marca linhas elegíveis como retrying e devolve-as (SKIP LOCKED). */
export async function claimHandlerFailuresForRetry(limit: number): Promise<EventHandlerFailureRow[]> {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const sel = await client.query<EventHandlerFailureRow>(
        `
        SELECT id, tenant_id::text, event_id::text, event_type, handler_key, attempts, max_attempts,
               next_retry_at, status, last_error
        FROM event_handler_failures
        WHERE (
            (status = 'pending' AND next_retry_at <= NOW())
            OR (status = 'retrying' AND updated_at < NOW() - INTERVAL '15 minutes')
          )
        ORDER BY next_retry_at ASC, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $1
        `,
        [limit]
      );

      if (sel.rows.length === 0) {
        await client.query('COMMIT');
        return [];
      }

      const ids = sel.rows.map((r) => r.id);
      await client.query(
        `
        UPDATE event_handler_failures
        SET status = 'retrying', updated_at = NOW()
        WHERE id = ANY($1::uuid[])
        `,
        [ids]
      );
      await client.query('COMMIT');
      return sel.rows;
    } catch (e) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code?: string }).code : undefined;
    if (code === '42P01') {
      if (getAuthorityMode() === 'strict') {
        console.error('[event-handler-failure] CRITICAL: tabela ausente (42P01) em strict mode — investigar infraestrutura');
        throw e;
      }
      console.error('[event-handler-failure] 42P01: tabela ausente (permissive mode)');
      return [];
    }
    throw e;
  }
}

export type EventLogRowForReplay = {
  event_id: string;
  tenant_id: string;
  event_type: string;
  event_version: number;
  payload: unknown;
  metadata: unknown;
  created_at: Date;
};

export async function loadEventLogForReplay(
  tenantId: string,
  eventId: string
): Promise<EventLogRowForReplay | undefined> {
  try {
    return await runQueryWithTenant<EventLogRowForReplay>(
      tenantId,
      `
      SELECT event_id::text, tenant_id::text, event_type, event_version, payload, metadata, created_at
      FROM event_log
      WHERE tenant_id = $1::uuid AND event_id = $2::uuid
      LIMIT 1
      `,
      [tenantId, eventId]
    );
  } catch (e) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code?: string }).code : undefined;
    if (code === '42P01') {
      if (getAuthorityMode() === 'strict') {
        console.error('[event-handler-failure] CRITICAL: tabela ausente (42P01) em strict mode — investigar infraestrutura');
        throw e;
      }
      console.error('[event-handler-failure] 42P01: tabela ausente (permissive mode)');
      return undefined;
    }
    throw e;
  }
}