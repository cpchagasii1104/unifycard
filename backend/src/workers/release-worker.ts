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
        // 🔴 F-GUC-CROSS-CONTEXT-RESET-ON-REUSE-FIX (2026-07-02, achado A1): reset explícito de
        // app.is_platform_admin junto — consistência com pool.ts. Worker default-off (HOLD,
        // religa só após #34 tenant-loop); claimSettledPaymentIntents cross-tenant é dívida
        // separada e já documentada (payment-intent-repository.ts), não fechada aqui.
        await client.query(
          "SELECT set_config('app.current_tenant', $1, false), set_config('app.is_platform_admin', 'false', false)",
          [intent.tenantId]
        );
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