// backend/src/modules/marketplace/core/events/voucher-events.ts
// Voucher domain events. Format: marketplace.voucher.<action> or .<action>.vN for versioned contract.

export const VoucherEvents = {
  REDEEMED_V1: 'marketplace.voucher.redeemed.v1',
} as const;

export type VoucherEventType = (typeof VoucherEvents)[keyof typeof VoucherEvents];