// backend/src/modules/marketplace/core/event-timeline.ts
// Ring buffer of last N domain events for replay, debug and quick audit.

export interface TimelineEvent {
  type: string;
  payload: unknown;
  occurredAt: Date;
  /** When the event was recorded by the bus (helps debug latency/async). */
  recordedAt: Date;
}

const timeline: TimelineEvent[] = [];
const MAX = 500;

export function recordEvent(event: { type: string; payload: unknown; occurredAt: Date }): void {
  timeline.push({
    type: event.type,
    payload: event.payload,
    occurredAt: event.occurredAt,
    recordedAt: new Date(),
  });
  if (timeline.length > MAX) {
    timeline.shift();
  }
}

export function getEventTimeline(): TimelineEvent[] {
  return [...timeline];
}