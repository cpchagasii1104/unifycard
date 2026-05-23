import { processEventOutboxCycle } from '@core/events/event-outbox.processor';

const INTERVAL_MS = 5_000;
let intervalId: ReturnType<typeof setInterval> | null = null;

export function startEventOutboxWorker(): void {
  if (intervalId !== null) return;
  processEventOutboxCycle().catch((err) => console.error('[EventOutboxWorker] initial cycle error:', err));
  intervalId = setInterval(() => {
    processEventOutboxCycle().catch((err) => console.error('[EventOutboxWorker] cycle error:', err));
  }, INTERVAL_MS);
  console.log('[EventOutboxWorker] Started (interval 5s, transactional outbox → EventBus)');
}