// backend/src/modules/subscriptions/subscription.types.ts
// SPRINT 87: ASSINATURAS (RECORRÊNCIA AUDITÁVEL)

export type SubscriptionInterval = 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

export interface Subscription {
  id: string;
  tenantId: string;
  contactId: string;
  paymentLinkId: string;
  amount: number;
  currency: string;
  interval: SubscriptionInterval;
  intervalCount: number;
  dayOfMonth: number | null;
  nextRunAt: Date;
  status: SubscriptionStatus;
  maxFailures: number;
  failureCount: number;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastPaymentIntentId: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  metadata: Record<string, any>;
  createdByActorId: string;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionInput {
  contactId: string;
  paymentLinkId: string;
  amount: number;
  currency?: string;
  interval: SubscriptionInterval;
  intervalCount?: number;
  dayOfMonth?: number | null;
  nextRunAt?: Date;
  maxFailures?: number;
  metadata?: Record<string, any>;
}

export interface SubscriptionFilters {
  contactId?: string;
  paymentLinkId?: string;
  status?: SubscriptionStatus;
  limit?: number;
  offset?: number;
}





