// backend/src/modules/marketplace/core/events/service-events.ts
// Service lifecycle domain events. Format: marketplace.service.<action> or .<action>.vN for versioned contract.

export const ServiceEvents = {
  COMPLETED_V1: 'marketplace.service.completed.v1',
} as const;

export type ServiceEventType = (typeof ServiceEvents)[keyof typeof ServiceEvents];