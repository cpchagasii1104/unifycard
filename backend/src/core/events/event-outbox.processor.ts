import { pool } from '@core/database/pool';
import { canonicalLogger } from '@core/logging/canonical-logger';
import { eventBus } from './event-bus';

const BATCH = 40;

type OutboxRow = {
  id: string;
  tenant_id: string;
  event_id: string;
  event_type: string;
  event_version: number;
  payload: unknown;
  metadata: unknown;
  attempts: number;
  max_attempts: number;
  next_retry_at: Date | string | null;
};

/**
 * Publica linhas pendentes da outbox (após commit da transação que as gravou).
 *
 * R3 (auditoria estrutural 2026-05-18):
 * - SELECT ... FOR UPDATE SKIP LOCKED permite múltiplos workers/processors em
 *   paralelo sem race: cada um pega rows distintas, lockadas pula automaticamente.
 * - SAVEPOINT por row torna publish+UPDATE atómico: crash/exception entre
 *   eventBus.publish e UPDATE published_at rolla back para o SAVEPOINT
 *   (não republish silencioso no próximo ciclo).
 * - DLQ (event_outbox_failed) e backoff exponencial-linear preservados.
 *
 * Idempotência: EventBus só executa handlers se event_log aceitar INSERT (RETURNING).
 */
export async function processEventOutboxCycle(): Promise<number> {
  let processed = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let rows: OutboxRow[];
    try {
      const sel = await client.query<OutboxRow>(
        `
        SELECT id, tenant_id, event_id, event_type, event_version, payload, metadata,
               attempts, max_attempts, next_retry_at
        FROM event_outbox
        WHERE published_at IS NULL
          AND (next_retry_at IS NULL OR next_retry_at <= NOW())
        ORDER BY created_at ASC, id ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
        `,
        [BATCH]
      );
      rows = sel.rows;
    } catch (e) {
      const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code?: string }).code : undefined;
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      if (code === '42P01') return 0;
      throw e;
    }

    if (rows.length === 0) {
      await client.query('COMMIT');
      return 0;
    }

    for (const row of rows) {
      await client.query('SAVEPOINT sp_outbox_row');
      try {
        await eventBus.publish({
          tenantId: String(row.tenant_id),
          type: row.event_type,
          version: Number(row.event_version) || 1,
          payload: (row.payload ?? {}) as Record<string, unknown>,
          metadata: (row.metadata ?? {}) as Record<string, unknown>,
          eventId: row.event_id,
        });
        await client.query(
          `UPDATE event_outbox SET published_at = NOW(), last_error = NULL WHERE id = $1`,
          [row.id]
        );
        await client.query('RELEASE SAVEPOINT sp_outbox_row');
        processed++;
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT sp_outbox_row');
        const msg = err instanceof Error ? err.message : String(err);
        const attemptsNext = Number(row.attempts) + 1;
        const maxAttempts = Number(row.max_attempts);

        if (attemptsNext >= maxAttempts) {
          await client.query(
            `
            INSERT INTO event_outbox_failed (
              original_id, tenant_id, event_id, event_type, payload, metadata, attempts, last_error
            )
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
            `,
            [
              row.id,
              row.tenant_id,
              row.event_id,
              row.event_type,
              JSON.stringify(row.payload ?? {}),
              JSON.stringify(row.metadata ?? {}),
              attemptsNext,
              msg.slice(0, 2000),
            ]
          );
          await client.query(
            `
            UPDATE event_outbox
            SET published_at = NOW(),
                attempts = attempts + 1,
                last_error = $2,
                next_retry_at = NULL
            WHERE id = $1
            `,
            [row.id, msg.slice(0, 2000)]
          );
          await client.query('RELEASE SAVEPOINT sp_outbox_row');
          canonicalLogger.warn(null, 'event_outbox excedeu max_attempts — movido para DLQ', {
            outboxId: row.id,
            eventId: row.event_id,
            error: msg,
            attempts: attemptsNext,
          });
        } else {
          await client.query(
            `
            UPDATE event_outbox
            SET attempts = attempts + 1,
                last_error = $2,
                next_retry_at = NOW() + ((attempts + 1) * interval '30 seconds')
            WHERE id = $1
            `,
            [row.id, msg.slice(0, 2000)]
          );
          await client.query('RELEASE SAVEPOINT sp_outbox_row');
          canonicalLogger.warn(null, 'event_outbox publish falhou (retry posterior)', {
            outboxId: row.id,
            eventId: row.event_id,
            error: msg,
          });
        }
      }
    }

    await client.query('COMMIT');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }

  return processed;
}
