// Release Worker — processa PaymentIntents settled: seller_pending → seller_available.
// Execução atômica: uma transação por ciclo — claim FOR UPDATE SKIP LOCKED, depois release com mesmo client.

import type { PoolClient } from 'pg';
import { pool } from '@core/database/pool';
import { claimSettledPaymentIntents } from '@modules/payments/payment-intent-repository';
import { releaseSettledPaymentIntent } from '@modules/gateway/payment-event-resolver';

const INTERVAL_MS = 10_000;
const BATCH_LIMIT = 50;
let intervalId: ReturnType<typeof setInterval> | null = null;

async function runReleaseCycle(): Promise<void> {
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const intents = await claimSettledPaymentIntents(client, BATCH_LIMIT);
    for (const intent of intents) {
      try {
        await client.query("SELECT set_config('app.current_tenant', $1, false)", [intent.tenantId]);
        console.log('PROCESSING_SETTLED_INTENT', intent.id);
        await releaseSettledPaymentIntent(intent.tenantId, intent, client);
        console.log('SETTLED_INTENT_RELEASED', intent.id);
      } catch (err) {
        console.error('[ReleaseWorker] Release failed for intent', intent.id, err);
        await client.query('ROLLBACK');
        return;
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    console.error('[ReleaseWorker] Cycle error:', err);
    await client?.query('ROLLBACK').catch(() => {});
  } finally {
    client?.release();
  }
}

export function startReleaseWorker(): void {
  if (intervalId !== null) return;
  runReleaseCycle().catch((err) => console.error('[ReleaseWorker] Initial run error:', err));
  intervalId = setInterval(runReleaseCycle, INTERVAL_MS);
  console.log('[ReleaseWorker] Started (interval 10s, batch limit 50)');
}