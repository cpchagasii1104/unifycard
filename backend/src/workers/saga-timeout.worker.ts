// INFRA-4 — expira sagas com timeout_at vencido; transição persistida + outbox (order.saga.timeout).

import { claimExpiredSagas } from '@modules/orders/order-saga.repository';
import { orderSagaService } from '@core/sagas/order-saga.service';

const INTERVAL_MS = Number(process.env.SAGA_TIMEOUT_WORKER_INTERVAL_MS ?? 15_000);
const BATCH = Number(process.env.SAGA_TIMEOUT_WORKER_BATCH ?? 25);

let intervalId: ReturnType<typeof setInterval> | null = null;

async function runSagaTimeoutCycle(): Promise<void> {
  try {
    const due = await claimExpiredSagas(BATCH);
    for (const row of due) {
      try {
        await orderSagaService.timeoutSaga(row.tenant_id, row.order_id);
      } catch (err) {
        console.error('[SagaTimeoutWorker] timeoutSaga failed', row.tenant_id, row.order_id, err);
      }
    }
  } catch (err) {
    console.error('[SagaTimeoutWorker] Cycle error:', err);
  }
}

export function startSagaTimeoutWorker(): void {
  if (intervalId !== null) return;
  runSagaTimeoutCycle().catch((e) => console.error('[SagaTimeoutWorker] Initial run:', e));
  intervalId = setInterval(() => {
    runSagaTimeoutCycle().catch((e) => console.error('[SagaTimeoutWorker] Cycle:', e));
  }, INTERVAL_MS);
  console.log(`[SagaTimeoutWorker] Started (interval ${INTERVAL_MS}ms, batch ${BATCH})`);
}