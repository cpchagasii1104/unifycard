// backend/src/modules/marketplace/core/events/trust-events.ts
// Trust / governance domain events. Format: marketplace.trust.<action> or .<action>.vN for versioned contract.

export const TrustEvents = {
  UPDATED_V1: 'marketplace.trust.updated.v1',
} as const;

export type TrustEventType = (typeof TrustEvents)[keyof typeof TrustEvents];