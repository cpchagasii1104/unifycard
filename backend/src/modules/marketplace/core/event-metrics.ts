// backend/src/modules/marketplace/core/event-metrics.ts
// In-memory counters per event type for observability and health/analytics.

const counters = new Map<string, number>();

export function incrementEvent(type: string): void {
  counters.set(type, (counters.get(type) ?? 0) + 1);
}

export function getEventMetrics(): Record<string, number> {
  return Object.fromEntries(counters);
}

export function resetEventMetrics(): void {
  counters.clear();
}