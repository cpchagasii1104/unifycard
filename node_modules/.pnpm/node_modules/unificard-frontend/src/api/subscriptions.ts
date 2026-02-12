// frontend/src/api/subscriptions.ts
// SPRINT 87: ASSINATURAS

import { apiFetch, apiFetchJson } from './client';

export interface Subscription {
  id: string;
  tenantId: string;
  contactId: string;
  paymentLinkId: string;
  amount: number;
  currency: string;
  interval: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  intervalCount: number;
  dayOfMonth: number | null;
  nextRunAt: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  maxFailures: number;
  failureCount: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastPaymentIntentId: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  metadata: Record<string, any>;
  createdByActorId: string;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionInput {
  contactId: string;
  paymentLinkId: string;
  amount: number;
  currency?: string;
  interval: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  intervalCount?: number;
  dayOfMonth?: number | null;
  nextRunAt?: string;
  maxFailures?: number;
  metadata?: Record<string, any>;
}

export interface SubscriptionFilters {
  contactId?: string;
  paymentLinkId?: string;
  status?: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  limit?: number;
  offset?: number;
}

export async function listSubscriptions(filters?: SubscriptionFilters): Promise<Subscription[]> {
  const params = new URLSearchParams();
  if (filters?.contactId) params.append('contactId', filters.contactId);
  if (filters?.paymentLinkId) params.append('paymentLinkId', filters.paymentLinkId);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.offset) params.append('offset', filters.offset.toString());

  const response = await apiFetch(`/subscriptions?${params.toString()}`);
  const data = await response.json();
  return data.subscriptions || [];
}

export async function getSubscriptionById(subscriptionId: string): Promise<Subscription> {
  const response = await apiFetch(`/subscriptions/${subscriptionId}`);
  const data = await response.json();
  return data;
}

export async function createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
  return await apiFetchJson('/subscriptions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function pauseSubscription(subscriptionId: string): Promise<Subscription> {
  return await apiFetchJson(`/subscriptions/${subscriptionId}/pause`, {
    method: 'POST',
  });
}

export async function resumeSubscription(subscriptionId: string): Promise<Subscription> {
  return await apiFetchJson(`/subscriptions/${subscriptionId}/resume`, {
    method: 'POST',
  });
}

export async function cancelSubscription(subscriptionId: string): Promise<Subscription> {
  return await apiFetchJson(`/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
  });
}

export async function runDueSubscriptions(limit?: number): Promise<{
  scheduled: number;
  results: Array<{ subscriptionId: string; success: boolean; error?: string }>;
}> {
  return await apiFetchJson('/subscriptions/run-due', {
    method: 'POST',
    body: JSON.stringify({ limit }),
  });
}





