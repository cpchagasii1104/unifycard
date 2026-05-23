import { processHandlerFailureCycle } from '@core/events/handler-failure.processor';

const INTERVAL_MS = 3_000;
let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Worker da camada 2: reexecuta apenas handlers falhos (nunca republica eventos).
 */
export function startHandlerFailureWorker(): void {
  if (intervalId !== null) return;
  processHandlerFailureCycle().catch((err) =>
    console.error('[HandlerFailureWorker] initial cycle error:', err)
  );
  intervalId = setInterval(() => {
    processHandlerFailureCycle().catch((err) => console.error('[HandlerFailureWorker] cycle error:', err));
  }, INTERVAL_MS);
  console.log('[HandlerFailureWorker] Started (interval 3s, handler retry layer)');
}