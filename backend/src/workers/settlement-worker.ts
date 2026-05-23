// Settlement Worker — processa PaymentIntents escrowed: escrow → seller_pending.
// Execução atômica: uma transação por ciclo — claim FOR UPDATE SKIP LOCKED, depois settle com mesmo client.

import type { PoolClient } from 'pg';
import { enqueueReconciliation } from '@core/events/payment-events-queue';
import { pool } from '@core/database/pool';
import { claimEscrowedPaymentIntents } from '@modules/payments/payment-intent-repository';
import { settleEscrowedPaymentIntent } from '@modules/gateway/payment-event-resolver';

const INTERVAL_MS = 10_000;
const BATCH_LIMIT = 50;
let intervalId: ReturnType<typeof setInterval> | null = null;

async function runSettlementCycle(): Promise<void> {
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const intents = await claimEscrowedPaymentIntents(client, BATCH_LIMIT);
    const settledForReconciliation: { tenantId: string; intentId: string }[] = [];
    for (const intent of intents) {
      try {
        await client.query("SELECT set_config('app.current_tenant', $1, false)", [intent.tenantId]);
        console.log('PROCESSING_ESCROWED_INTENT', intent.id);
        await settleEscrowedPaymentIntent(intent.tenantId, intent, client);
        settledForReconciliation.push({ tenantId: intent.tenantId, intentId: intent.id });
        console.log('ESCROWED_INTENT_SETTLED', intent.id);
      } catch (err) {
        console.error('[SettlementWorker] Settlement failed for intent', intent.id, err);
        await client.query('ROLLBACK');
        return;
      }
    }
    await client.query('COMMIT');
    for (const s of settledForReconciliation) {
      enqueueReconciliation({
        tenant_id: s.tenantId,
        reference_type: 'payment_intent',
        reference_id: s.intentId,
      });
    }
  } catch (err) {
    console.error('[SettlementWorker] Cycle error:', err);
    await client?.query('ROLLBACK').catch(() => {});
  } finally {
    client?.release();
  }
}

export function startSettlementWorker(): void {
  if (intervalId !== null) return;
  runSettlementCycle().catch((err) => console.error('[SettlementWorker] Initial run error:', err));
  intervalId = setInterval(runSettlementCycle, INTERVAL_MS);
  console.log('[SettlementWorker] Started (interval 10s, batch limit 50)');
}