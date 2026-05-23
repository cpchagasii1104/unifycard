// Prompt 51 — Reversal Worker: processa reversals pending → executeReversal (transfer espelhado).

import { claimPendingReversals } from '@modules/reversal/reversal.repository';
import { executeReversal } from '@modules/reversal/reversal.service';

const INTERVAL_MS = 30_000;
const BATCH_LIMIT = 30;
let intervalId: ReturnType<typeof setInterval> | null = null;

async function runReversalCycle(): Promise<void> {
  try {
    const claimed = await claimPendingReversals(BATCH_LIMIT);
    for (const r of claimed) {
      try {
        console.log('[ReversalWorker] Processing reversal', r.id, r.tenantId, r.originalTransactionId);
        await executeReversal(r.tenantId, r.id);
        console.log('[ReversalWorker] Executed reversal', r.id);
      } catch (err) {
        console.error('[ReversalWorker] Failed reversal', r.id, err);
      }
    }
  } catch (err) {
    console.error('[ReversalWorker] Cycle error:', err);
  }
}

export function startReversalWorker(): void {
  if (intervalId !== null) return;
  runReversalCycle().catch((e) => console.error('[ReversalWorker] Initial run:', e));
  intervalId = setInterval(runReversalCycle, INTERVAL_MS);
  console.log('[ReversalWorker] Started (interval 30s, batch 30)');
}