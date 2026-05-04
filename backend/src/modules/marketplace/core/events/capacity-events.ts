// backend/src/modules/marketplace/core/events/capacity-events.ts
// Capacity domain events. Format: marketplace.capacity.<action> or .<action>.vN for versioned contract.

export const CapacityEvents = {
  UPDATED_V1: 'marketplace.capacity.updated.v1',
} as const;

export type CapacityEventType = (typeof CapacityEvents)[keyof typeof CapacityEvents];