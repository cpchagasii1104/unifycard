// backend/src/modules/marketplace/core/events/payment-events.ts
// Payment domain events. Format: marketplace.payment.<action> or .<action>.vN for versioned contract.

export const PaymentEvents = {
  HOLD_CREATED_V1: 'marketplace.payment.hold.created.v1',
  RELEASED_V1: 'marketplace.payment.released.v1',
} as const;

export type PaymentEventType = (typeof PaymentEvents)[keyof typeof PaymentEvents];