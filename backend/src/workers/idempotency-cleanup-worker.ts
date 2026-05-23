import { pool } from '@core/database/pool';

const INTERVAL_MS = 60 * 60 * 1000;
let intervalId: ReturnType<typeof setInterval> | null = null;

async function runIdempotencyCleanupCycle(): Promise<void> {
  try {
    const r = await pool.query<{ n: string }>(
      'SELECT cleanup_idempotency_keys()::text AS n'
    );
    const n = Number(r.rows[0]?.n ?? 0);
    if (n > 0) {
      console.log(`[IdempotencyCleanupWorker] removed ${n} idempotency_keys row(s)`);
    }
  } catch (err) {
    console.error('[IdempotencyCleanupWorker] cycle error:', err);
  }
}

export function startIdempotencyCleanupWorker(): void {
  if (intervalId !== null) return;
  runIdempotencyCleanupCycle().catch((err) =>
    console.error('[IdempotencyCleanupWorker] initial run error:', err)
  );
  intervalId = setInterval(runIdempotencyCleanupCycle, INTERVAL_MS);
  console.log('[IdempotencyCleanupWorker] Started (interval 1h, DELETE where created_at < now() - 24h)');
}