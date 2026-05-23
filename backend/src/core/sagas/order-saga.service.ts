// INFRA-4 — Coordenação multi-módulo (pedido → pagamento → fulfillment → ledger).
// Estado persistido em order_sagas; eventos apenas via outbox; sem alterar event_bus.

import { getClientWithTenant } from '@core/database/pool';
import { insertEventOutboxRow, outboxEventIdFromSeed } from '@core/events/event-outbox.repository';
import { canonicalLogger } from '@core/logging/canonical-logger';
import {
  getByOrderId,
  insertSaga,
  lockSagaForUpdate,
  updateSagaRow,
  type OrderSagaStatus,
} from '@modules/orders/order-saga.repository';

const DEFAULT_TIMEOUT_MS = Number(process.env.ORDER_SAGA_TIMEOUT_MS ?? 3_600_000);

/** Alvo da transição (próximo status). */
export type SagaAdvanceTarget = 'payment_pending' | 'paid' | 'fulfilled';

/** Bloco JSON em `order_sagas.payload` (INFRA-4.2); sem migration. */
export type SagaCompensationPayload = {
  enabled: boolean;
  executed: boolean;
  originalTransactionId?: string;
  executedAt?: string;
};

export type FailSagaOptions = {
  compensation?: {
    originalTransactionId: string;
    enabled?: boolean;
  };
};

function sagaTimeoutDate(): Date {
  return new Date(Date.now() + DEFAULT_TIMEOUT_MS);
}

function emitSagaTransitionMetric(from: string, to: string, tenantId: string): void {
  canonicalLogger.info(null, 'saga_transition', {
    metric_event: 'saga_transition',
    tenantId,
    sagaFromStatus: from,
    sagaToStatus: to,
  });
}

function emitSagaTimeoutMetric(tenantId: string): void {
  canonicalLogger.info(null, 'saga_timeout', {
    metric_event: 'saga_timeout',
    tenantId,
    sagaFromStatus: '_na',
    sagaToStatus: 'cancelled',
  });
}

function emitSagaFailureMetric(tenantId: string, reason: string): void {
  canonicalLogger.info(null, 'saga_failure', {
    metric_event: 'saga_failure',
    tenantId,
    sagaFromStatus: '_na',
    sagaToStatus: 'failed',
    sagaFailureReason: reason.slice(0, 200),
  });
}

const ADVANCE_MAP: Record<string, SagaAdvanceTarget | undefined> = {
  created: 'payment_pending',
  payment_pending: 'paid',
  paid: 'fulfilled',
};

function expectedNext(current: string, target: SagaAdvanceTarget): boolean {
  return ADVANCE_MAP[current] === target;
}

function stepForStatus(s: OrderSagaStatus | string): string {
  switch (s) {
    case 'created':
      return 'order_created';
    case 'payment_pending':
      return 'awaiting_payment';
    case 'paid':
      return 'payment_settled';
    case 'fulfilled':
      return 'fulfillment_complete';
    case 'failed':
      return 'saga_failed';
    case 'cancelled':
      return 'timeout_cancelled';
    default:
      return 'unknown';
  }
}

class OrderSagaService {
  /**
   * Inicia saga para o pedido. Falha se já existir linha (UNIQUE tenant+order).
   */
  async startSaga(tenantId: string, orderId: string): Promise<void> {
    const existing = await getByOrderId(tenantId, orderId);
    if (existing) {
      throw new Error('ORDER_SAGA_ALREADY_EXISTS');
    }

    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');
      const row = await insertSaga(client, tenantId, orderId, {
        timeoutAt: sagaTimeoutDate(),
      });
      await insertEventOutboxRow(client, {
        tenantId,
        eventId: outboxEventIdFromSeed(`order.saga.started:${tenantId}:${orderId}`),
        eventType: 'order.saga.started',
        eventVersion: 1,
        payload: {
          orderId,
          status: row.status,
          currentStep: row.current_step,
          timeoutAt: row.timeout_at?.toISOString() ?? null,
        },
      });
      await client.query('COMMIT');
      emitSagaTransitionMetric('_start', String(row.status), tenantId);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Avança saga para o próximo estágio canónico (created→payment_pending→paid→fulfilled).
   */
  async advanceSaga(tenantId: string, orderId: string, target: SagaAdvanceTarget): Promise<void> {
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');
      const row = await lockSagaForUpdate(client, tenantId, orderId);
      if (!row) {
        await client.query('ROLLBACK');
        throw new Error('ORDER_SAGA_NOT_FOUND');
      }
      const prev = String(row.status);
      if (prev === 'failed' || prev === 'cancelled' || prev === 'fulfilled') {
        await client.query('ROLLBACK');
        throw new Error(`ORDER_SAGA_TERMINAL:${prev}`);
      }
      if (!expectedNext(prev, target)) {
        await client.query('ROLLBACK');
        emitSagaFailureMetric(tenantId, `invalid_advance:${prev}->${target}`);
        throw new Error(`ORDER_SAGA_INVALID_ADVANCE:${prev}->${target}`);
      }

      const newStatus = target as OrderSagaStatus;
      const updated = await updateSagaRow(client, tenantId, orderId, {
        status: newStatus,
        current_step: stepForStatus(newStatus),
        attemptsIncrement: true,
      });

      await insertEventOutboxRow(client, {
        tenantId,
        eventId: outboxEventIdFromSeed(`order.saga:${tenantId}:${orderId}:${newStatus}`),
        eventType: 'order.saga.advanced',
        eventVersion: 1,
        payload: {
          orderId,
          previousStatus: prev,
          newStatus,
          currentStep: updated.current_step,
        },
      });
      await client.query('COMMIT');
      emitSagaTransitionMetric(prev, newStatus, tenantId);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async failSaga(
    tenantId: string,
    orderId: string,
    reason: string,
    options?: FailSagaOptions
  ): Promise<void> {
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');
      const row = await lockSagaForUpdate(client, tenantId, orderId);
      if (!row) {
        await client.query('ROLLBACK');
        throw new Error('ORDER_SAGA_NOT_FOUND');
      }
      const prev = String(row.status);
      if (prev === 'failed' || prev === 'cancelled' || prev === 'fulfilled') {
        await client.query('ROLLBACK');
        return;
      }

      const basePayload: Record<string, unknown> = {
        ...(row.payload ?? {}),
        lastFailureReason: reason.slice(0, 2_000),
      };

      if (options?.compensation?.originalTransactionId) {
        basePayload.compensation = {
          enabled: options.compensation.enabled !== false,
          executed: false,
          originalTransactionId: options.compensation.originalTransactionId,
        };
      }

      const comp = basePayload.compensation;
      if (
        comp &&
        typeof comp === 'object' &&
        !Array.isArray(comp) &&
        (comp as { enabled?: unknown }).enabled === true &&
        (comp as { executed?: unknown }).executed !== true
      ) {
        // INFRA-4.2: só intenção no JSON — nunca compensateTransaction aqui.
      }

      await updateSagaRow(client, tenantId, orderId, {
        status: 'failed',
        current_step: stepForStatus('failed'),
        attemptsIncrement: true,
        payload: basePayload,
      });

      await insertEventOutboxRow(client, {
        tenantId,
        eventId: outboxEventIdFromSeed(`order.saga.failed:${tenantId}:${orderId}`),
        eventType: 'order.saga.failed',
        eventVersion: 1,
        payload: { orderId, previousStatus: prev, reason: reason.slice(0, 2_000) },
      });
      await client.query('COMMIT');
      emitSagaFailureMetric(tenantId, reason);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /**
   * Timeout: cancela saga se o prazo foi ultrapassado (idempotente se já terminal).
   */
  async timeoutSaga(tenantId: string, orderId: string): Promise<void> {
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');
      const row = await lockSagaForUpdate(client, tenantId, orderId);
      if (!row) {
        await client.query('ROLLBACK');
        return;
      }
      const prev = String(row.status);
      if (prev === 'fulfilled' || prev === 'failed' || prev === 'cancelled') {
        await client.query('ROLLBACK');
        return;
      }
      const t = row.timeout_at ? new Date(row.timeout_at).getTime() : null;
      if (t === null || t > Date.now()) {
        await client.query('ROLLBACK');
        return;
      }

      await updateSagaRow(client, tenantId, orderId, {
        status: 'cancelled',
        current_step: stepForStatus('cancelled'),
        attemptsIncrement: true,
      });

      await insertEventOutboxRow(client, {
        tenantId,
        eventId: outboxEventIdFromSeed(`order.saga.timeout:${tenantId}:${orderId}`),
        eventType: 'order.saga.timeout',
        eventVersion: 1,
        payload: {
          orderId,
          previousStatus: prev,
          newStatus: 'cancelled',
        },
      });
      await client.query('COMMIT');
      emitSagaTimeoutMetric(tenantId);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

export const orderSagaService = new OrderSagaService();