import { canonicalLogger } from '@core/logging/canonical-logger';
import type { UnificardEvent } from './event-bus';
import { eventBus } from './event-bus';
import {
  claimHandlerFailuresForRetry,
  deleteHandlerFailure,
  loadEventLogForReplay,
  upsertHandlerFailure,
} from './event-handler-failure.repository';

const BATCH = 20;

function rowToEvent(row: Awaited<ReturnType<typeof loadEventLogForReplay>>): UnificardEvent {
  if (!row) {
    throw new Error('EVENT_LOG_ROW_MISSING');
  }
  return {
    eventId: row.event_id,
    tenantId: row.tenant_id,
    type: row.event_type,
    version: Number(row.event_version) || 1,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

/**
 * Processa falhas de handler: reexecuta apenas o handler_key (nunca publish).
 */
export async function processHandlerFailureCycle(): Promise<number> {
  const rows = await claimHandlerFailuresForRetry(BATCH);
  let ok = 0;

  for (const row of rows) {
    try {
      const logRow = await loadEventLogForReplay(row.tenant_id, row.event_id);
      if (!logRow) {
        await upsertHandlerFailure({
          tenantId: row.tenant_id,
          eventId: row.event_id,
          eventType: row.event_type,
          handlerKey: row.handler_key,
          errorMessage: 'event_log row missing — cannot replay handler safely',
        });
        canonicalLogger.error(null, 'handler_failure_event_log_missing', {
          metric_event: 'handler_failure_event_log_missing',
          failureId: row.id,
          tenantId: row.tenant_id,
          eventId: row.event_id,
          handlerKey: row.handler_key,
        });
        continue;
      }

      const event = rowToEvent(logRow);
      canonicalLogger.info(null, 'handler_retry_attempt', {
        metric_event: 'handler_retry_attempt',
        failureId: row.id,
        tenantId: row.tenant_id,
        eventId: row.event_id,
        eventType: row.event_type,
        handlerKey: row.handler_key,
        attempts: row.attempts,
      });
      await eventBus.invokeHandlerOnly(row.handler_key, event);
      await deleteHandlerFailure(row.id);
      ok++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await upsertHandlerFailure({
        tenantId: row.tenant_id,
        eventId: row.event_id,
        eventType: row.event_type,
        handlerKey: row.handler_key,
        errorMessage: msg,
        maxAttempts: row.max_attempts,
      });
      canonicalLogger.error(null, 'handler_retry_failed', {
        metric_event: 'handler_retry_failed',
        failureId: row.id,
        handlerKey: row.handler_key,
        eventId: row.event_id,
        tenantId: row.tenant_id,
        error: msg,
      });
    }
  }

  return ok;
}