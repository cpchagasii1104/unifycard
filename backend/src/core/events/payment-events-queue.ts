// Gateway Event Queue — fila de eventos de pagamento (BullMQ).
// Webhooks enfileiram; worker processa. Nenhuma escrita direta em bank_transactions/ledger.
//
// Redis é opcional no boot: defina REDIS_ENABLED=false (ou 0) para não criar Queue/Worker
// quando não houver servidor Redis local (evita erros de conexão no arranque).

import { Queue, Worker } from 'bullmq';

const QUEUE_NAME = 'payment-events';

/**
 * Fila BullMQ ativa apenas quando Redis está habilitado explicitamente ou por omissão.
 * REDIS_ENABLED=false | 0 | no → não conecta; enqueue vira no-op com aviso.
 */
export function isRedisQueueEnabled(): boolean {
  const v = process.env.REDIS_ENABLED?.trim().toLowerCase();
  return v !== 'false' && v !== '0' && v !== 'no';
}

function buildConnection(): { url: string } | { host: string; port: number } {
  const url = process.env.REDIS_URL;
  if (url) {
    return { url };
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
  };
}

let queueInstance: Queue | null = null;
let workerInstance: Worker | null = null;

export interface PaymentEvent {
  type: string;
  tenant_id: string;
  reference_type: string;
  reference_id: string;
  amount_cents: number;
  actor_id: string | null;
  metadata?: Record<string, unknown>;
}

/** Gatilho determinístico pós-mutação financeira → worker roda motor de reconciliação (sem bloquear o produtor). */
export interface ReconciliationTriggerJob {
  tenant_id: string;
  reference_type: string;
  reference_id: string;
}

const JOB_PAYMENT_EVENT = 'payment-event';
const JOB_RECONCILIATION_TRIGGER = 'reconciliation-trigger';

export function getPaymentEventsQueue(): Queue {
  if (!isRedisQueueEnabled()) {
    throw new Error(
      'Fila payment-events indisponível: REDIS_ENABLED=false. Ative Redis ou defina REDIS_ENABLED=true.'
    );
  }
  if (!queueInstance) {
    queueInstance = new Queue(QUEUE_NAME, { connection: buildConnection() });
  }
  return queueInstance;
}

export function getPaymentEventsWorker(
  processPaymentEvent: (event: PaymentEvent) => Promise<void>,
  processReconciliationTrigger: (payload: ReconciliationTriggerJob) => Promise<void>
): Worker {
  if (!isRedisQueueEnabled()) {
    throw new Error(
      'Worker payment-events não disponível: REDIS_ENABLED=false. Ative Redis ou defina REDIS_ENABLED=true.'
    );
  }
  if (workerInstance) {
    return workerInstance;
  }
  workerInstance = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === JOB_PAYMENT_EVENT && job.data) {
        await processPaymentEvent(job.data as PaymentEvent);
        return;
      }
      if (job.name === JOB_RECONCILIATION_TRIGGER && job.data) {
        await processReconciliationTrigger(job.data as ReconciliationTriggerJob);
        return;
      }
    },
    { connection: buildConnection() }
  );
  return workerInstance;
}

export async function enqueuePaymentEvent(event: PaymentEvent): Promise<void> {
  if (!isRedisQueueEnabled()) {
    console.warn(
      '[payment-events-queue] Redis desativado (REDIS_ENABLED=false); evento não enfileirado:',
      event.reference_type,
      event.reference_id
    );
    return;
  }
  const queue = getPaymentEventsQueue();
  await queue.add(JOB_PAYMENT_EVENT, event);
}

/**
 * Publica gatilho de reconciliação na mesma fila Redis/BullMQ dos payment-events.
 * Não bloqueia: não await no chamador; falhas de enqueue só logam.
 */
export function enqueueReconciliation(payload: ReconciliationTriggerJob): void {
  if (!isRedisQueueEnabled()) {
    console.warn(
      '[payment-events-queue] Redis desativado; reconciliation-trigger não enfileirado:',
      payload.reference_type,
      payload.reference_id
    );
    return;
  }
  void getPaymentEventsQueue()
    .add(JOB_RECONCILIATION_TRIGGER, payload, { removeOnComplete: 1000 })
    .catch((err: unknown) =>
      console.warn(
        '[payment-events-queue] reconciliation-trigger enqueue falhou:',
        err instanceof Error ? err.message : err
      )
    );
}

export { QUEUE_NAME };