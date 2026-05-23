// INFRA-4.2 — order.saga.failed → compensação ledger controlada (handler único; failSaga não executa ledger).

import { getClientWithTenant, runQueryWithTenant } from '@core/database/pool';
import { insertEventOutboxRow, outboxEventIdFromSeed } from '@core/events/event-outbox.repository';
import type { EventBus, UnificardEvent } from '@core/events/event-bus';
import { checkIdempotency, recordIdempotencySuccess } from '@core/events/idempotency-tracker';
import { canonicalLogger } from '@core/logging/canonical-logger';
import { compensateTransaction } from '@modules/bank/ledger-compensation.service';
import {
  getByOrderId,
  lockSagaForUpdate,
  updateSagaRow,
} from '@modules/orders/order-saga.repository';

const HANDLER_KEY = 'saga.compensation.handler';
const PAID_LIKE = new Set(['paid', 'fulfilled']);

function isCompensationObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function emitSkipped(tenantId: string, reason: string): void {
  canonicalLogger.info(null, 'saga_compensation_skipped', {
    metric_event: 'saga_compensation_skipped',
    tenantId,
    handlerKey: HANDLER_KEY,
    eventType: 'order.saga.failed',
    sagaCompensationSkipReason: reason,
  });
}

function emitTriggered(tenantId: string): void {
  canonicalLogger.info(null, 'saga_compensation_triggered', {
    metric_event: 'saga_compensation_triggered',
    tenantId,
    handlerKey: HANDLER_KEY,
    eventType: 'order.saga.failed',
  });
}

function emitSuccess(tenantId: string): void {
  canonicalLogger.info(null, 'saga_compensation_success', {
    metric_event: 'saga_compensation_success',
    tenantId,
    handlerKey: HANDLER_KEY,
    eventType: 'order.saga.failed',
  });
}

function logPartialCommit(
  tenantId: string,
  orderId: string,
  eventId: string,
  originalTransactionId: string,
  detail: string,
  err?: unknown
): void {
  canonicalLogger.error(null, 'SAGA_COMPENSATION_PARTIAL_COMMIT', {
    tenantId,
    orderId,
    eventId,
    originalTransactionId,
    sagaCompensationPartialCommitPhase: detail,
    error: err instanceof Error ? err.message.slice(0, 500) : err != null ? String(err).slice(0, 500) : undefined,
  });
}

/**
 * Regra: Saga decide (payload); handler executa; ledger via compensateTransaction apenas aqui.
 * Não chama eventBus.publish — efeitos: ledger + merge payload + outbox de auditoria (idempotente por seed).
 */
export async function handleOrderSagaFailedCompensation(event: UnificardEvent): Promise<void> {
  const tenantId = event.tenantId;
  const orderId = typeof event.payload.orderId === 'string' ? event.payload.orderId : '';
  const previousStatus =
    typeof event.payload.previousStatus === 'string' ? event.payload.previousStatus : '';

  if (!orderId) {
    emitSkipped(tenantId, 'missing_order_id');
    return;
  }

  const existingIdem = await checkIdempotency(tenantId, event.eventId, HANDLER_KEY, event.payload);
  if (existingIdem?.resultStatus === 'success') {
    emitSkipped(tenantId, 'handler_event_idempotent_replay');
    return;
  }
  if (existingIdem?.resultStatus === 'skipped') {
    emitSkipped(tenantId, 'handler_event_idempotent_skipped_replay');
    return;
  }

  const saga = await getByOrderId(tenantId, orderId);
  if (!saga || saga.status !== 'failed') {
    emitSkipped(tenantId, 'saga_not_failed');
    return;
  }

  const rawComp = saga.payload.compensation;
  if (!isCompensationObject(rawComp) || rawComp.enabled !== true) {
    emitSkipped(tenantId, 'compensation_disabled_or_absent');
    return;
  }
  if (rawComp.executed === true) {
    emitSkipped(tenantId, 'already_executed');
    return;
  }

  const originalTransactionId =
    typeof rawComp.originalTransactionId === 'string' ? rawComp.originalTransactionId.trim() : '';
  if (!originalTransactionId) {
    emitSkipped(tenantId, 'missing_original_transaction_id');
    return;
  }

  if (!PAID_LIKE.has(previousStatus)) {
    emitSkipped(tenantId, 'no_payment_before_failure');
    return;
  }

  // SSOT de liquidação em `bank_transactions`: `internal_completed_at` (não há coluna `status` na tabela).
  // Equivale semanticamente a “transação completed” no domínio; alinhado a `compensateTransaction`.
  const txRow = await runQueryWithTenant<{ internal_completed_at: Date | null }>(
    tenantId,
    `SELECT internal_completed_at FROM bank_transactions
     WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1`,
    [tenantId, originalTransactionId]
  );
  if (!txRow || txRow.internal_completed_at == null) {
    emitSkipped(tenantId, 'original_transaction_not_settled');
    return;
  }

  emitTriggered(tenantId);

  const reason = `order_saga_failed:${orderId}`;
  await compensateTransaction(tenantId, originalTransactionId, reason);
  const ledgerCompensatedThisInvocation = true;

  const client = await getClientWithTenant(tenantId);
  try {
    await client.query('BEGIN');
    const row = await lockSagaForUpdate(client, tenantId, orderId);
    if (!row || row.status !== 'failed') {
      await client.query('ROLLBACK');
      if (ledgerCompensatedThisInvocation) {
        logPartialCommit(tenantId, orderId, event.eventId, originalTransactionId, 'saga_not_failed_after_ledger');
      }
      return;
    }

    const comp = row.payload.compensation;
    if (!isCompensationObject(comp) || comp.enabled !== true) {
      await client.query('ROLLBACK');
      if (ledgerCompensatedThisInvocation) {
        logPartialCommit(tenantId, orderId, event.eventId, originalTransactionId, 'compensation_intent_missing_after_ledger');
      }
      return;
    }
    if (comp.executed === true) {
      await client.query('ROLLBACK');
      emitSkipped(tenantId, 'already_executed_race');
      return;
    }

    const tid = typeof comp.originalTransactionId === 'string' ? comp.originalTransactionId.trim() : '';
    if (tid !== originalTransactionId) {
      await client.query('ROLLBACK');
      if (ledgerCompensatedThisInvocation) {
        logPartialCommit(tenantId, orderId, event.eventId, originalTransactionId, 'payload_transaction_id_race');
      }
      throw new Error('SAGA_COMPENSATION_PAYLOAD_RACE');
    }

    const newPayload: Record<string, unknown> = {
      ...row.payload,
      compensation: {
        ...comp,
        executed: true,
        executedAt: new Date().toISOString(),
      },
    };

    await updateSagaRow(client, tenantId, orderId, {
      status: 'failed',
      current_step: row.current_step,
      payload: newPayload,
    });

    await insertEventOutboxRow(client, {
      tenantId,
      eventId: outboxEventIdFromSeed(`saga.compensation:${tenantId}:${orderId}`),
      eventType: 'order.saga.compensation.executed',
      eventVersion: 1,
      payload: {
        orderId,
        originalTransactionId,
        previousStatus,
      },
    });

    await client.query('COMMIT');
    await recordIdempotencySuccess(tenantId, event.eventId, 'order.saga.failed', HANDLER_KEY, event.payload, {
      orderId,
      originalTransactionId,
    });
    emitSuccess(tenantId);
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    if (ledgerCompensatedThisInvocation) {
      logPartialCommit(
        tenantId,
        orderId,
        event.eventId,
        originalTransactionId,
        'saga_or_outbox_tx_failed_after_ledger',
        e
      );
    }
    throw e;
  } finally {
    client.release();
  }
}

export function registerSagaCompensationHandler(bus: EventBus): void {
  bus.registerHandler('order.saga.failed', HANDLER_KEY, handleOrderSagaFailedCompensation);
}