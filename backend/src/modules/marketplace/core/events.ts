// backend/src/modules/marketplace/core/events.ts
// Domain event types for cross-domain reactions (Event Bus).
// Event type strings come from the central registry (event-registry.ts).

import type { DomainEvent } from './event-bus';
import { MarketplaceEvents } from './event-registry';

export const ServiceCompletedEventType = MarketplaceEvents.SERVICE_COMPLETED;
export const PaymentHoldCreatedEventType = MarketplaceEvents.PAYMENT_HOLD_CREATED;
export const PaymentReleasedEventType = MarketplaceEvents.PAYMENT_RELEASED;
export const VoucherRedeemedEventType = MarketplaceEvents.VOUCHER_REDEEMED;
export const TrustScoreUpdatedEventType = MarketplaceEvents.TRUST_UPDATED;
export const CapacityUpdatedEventType = MarketplaceEvents.CAPACITY_UPDATED;

export interface ServiceCompletedPayload {
  providerId: string;
  requestId: string;
  visitId: string;
}

export interface PaymentHoldCreatedPayload {
  holdId: string;
  requestId: string;
}

export interface PaymentReleasedPayload {
  holdId: string;
  requestId: string;
  releasedBy: string;
}

export interface VoucherRedeemedPayload {
  voucherClaimId: string;
  offeringId: string;
  actorId: string;
}

export interface TrustScoreUpdatedPayload {
  actorId: string;
  eventType: string;
}

export interface CapacityUpdatedPayload {
  resourceId?: string;
  storeId?: string;
  eventType: string;
}

export function createDomainEvent<T>(type: string, payload: T): DomainEvent<T> {
  return {
    type,
    payload,
    occurredAt: new Date(),
  };
}

export class ServiceCompletedEvent implements DomainEvent<ServiceCompletedPayload> {
  type = ServiceCompletedEventType;
  payload: ServiceCompletedPayload;
  occurredAt: Date;

  constructor(payload: ServiceCompletedPayload) {
    this.payload = payload;
    this.occurredAt = new Date();
  }
}

export class PaymentHoldCreatedEvent implements DomainEvent<PaymentHoldCreatedPayload> {
  type = PaymentHoldCreatedEventType;
  payload: PaymentHoldCreatedPayload;
  occurredAt: Date;

  constructor(payload: PaymentHoldCreatedPayload) {
    this.payload = payload;
    this.occurredAt = new Date();
  }
}

export class PaymentReleasedEvent implements DomainEvent<PaymentReleasedPayload> {
  type = PaymentReleasedEventType;
  payload: PaymentReleasedPayload;
  occurredAt: Date;

  constructor(payload: PaymentReleasedPayload) {
    this.payload = payload;
    this.occurredAt = new Date();
  }
}

export class VoucherRedeemedEvent implements DomainEvent<VoucherRedeemedPayload> {
  type = VoucherRedeemedEventType;
  payload: VoucherRedeemedPayload;
  occurredAt: Date;

  constructor(payload: VoucherRedeemedPayload) {
    this.payload = payload;
    this.occurredAt = new Date();
  }
}

export class TrustScoreUpdatedEvent implements DomainEvent<TrustScoreUpdatedPayload> {
  type = TrustScoreUpdatedEventType;
  payload: TrustScoreUpdatedPayload;
  occurredAt: Date;

  constructor(payload: TrustScoreUpdatedPayload) {
    this.payload = payload;
    this.occurredAt = new Date();
  }
}

export class CapacityUpdatedEvent implements DomainEvent<CapacityUpdatedPayload> {
  type = CapacityUpdatedEventType;
  payload: CapacityUpdatedPayload;
  occurredAt: Date;

  constructor(payload: CapacityUpdatedPayload) {
    this.payload = payload;
    this.occurredAt = new Date();
  }
}