// backend/src/modules/marketplace/core/event-registry.ts
// Central barrel for all domain events. Single source of truth for event type names.
//
// All domain events must be registered in core/events/<domain>-events.ts.
//
// Rules:
// 1. Event names must follow the format: marketplace.<domain>.<action> or .<action>.vN for versioned contract.
// 2. Domains may emit events but must not subscribe to their own events.
// 3. Cross-domain coordination must happen via events, not direct calls.
// 4. Version (.v1, .v2) enables payload evolution without breaking consumers; add new version instead of changing in place.

export { ServiceEvents } from './events/service-events';
export { PaymentEvents } from './events/payment-events';
export { VoucherEvents } from './events/voucher-events';
export { TrustEvents } from './events/trust-events';
export { CapacityEvents } from './events/capacity-events';

import { ServiceEvents } from './events/service-events';
import { PaymentEvents } from './events/payment-events';
import { VoucherEvents } from './events/voucher-events';
import { TrustEvents } from './events/trust-events';
import { CapacityEvents } from './events/capacity-events';

/** Flat registry for backward compatibility. Values are versioned (.v1) for stable contract and future evolution. */
export const MarketplaceEvents = {
  SERVICE_COMPLETED: ServiceEvents.COMPLETED_V1,
  PAYMENT_HOLD_CREATED: PaymentEvents.HOLD_CREATED_V1,
  PAYMENT_RELEASED: PaymentEvents.RELEASED_V1,
  VOUCHER_REDEEMED: VoucherEvents.REDEEMED_V1,
  TRUST_UPDATED: TrustEvents.UPDATED_V1,
  CAPACITY_UPDATED: CapacityEvents.UPDATED_V1,
} as const;

export type MarketplaceEventType = (typeof MarketplaceEvents)[keyof typeof MarketplaceEvents];