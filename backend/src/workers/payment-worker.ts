// Payment Worker — consome fila payment-events e encaminha para o processador de gateway.
// Não altera bank_transactions, bank_ledger nem bank_accounts.

import { getPaymentEventsWorker, isRedisQueueEnabled } from '../core/events/payment-events-queue';
import { processPaymentEvent } from '../modules/gateway/payment-event-processor';
import { processReconciliationTrigger } from '../modules/reconciliation/reconciliation-trigger.processor';

let workerStarted = false;

/** @returns true se o Worker BullMQ foi iniciado; false se Redis/fila desativados (boot resiliente). */
export function startPaymentWorker(): boolean {
  if (workerStarted) return true;

  if (!isRedisQueueEnabled()) {
    console.warn(
      '[PaymentWorker] Não iniciado: REDIS_ENABLED=false — fila payment-events desativada (boot sem Redis).'
    );
    return false;
  }

  const worker = getPaymentEventsWorker(processPaymentEvent, processReconciliationTrigger);

  let redisErrorLogged = false;
  worker.on('error', (err: Error) => {
    if (!redisErrorLogged) {
      console.warn(
        '[PaymentWorker] Erro de conexão Redis/BullMQ (não fatal). Verifique Redis ou use REDIS_ENABLED=false:',
        err?.message ?? err
      );
      redisErrorLogged = true;
    } else {
      console.warn('[PaymentWorker] Redis:', err?.message ?? err);
    }
  });

  worker.on('completed', (job) => {
    console.log('[PaymentWorker] Job completed', job.id);
  });
  worker.on('failed', (job, err) => {
    console.warn('[PaymentWorker] Job failed', job?.id, err?.message);
  });
  workerStarted = true;
  console.log('[PaymentWorker] Started');
  return true;
}