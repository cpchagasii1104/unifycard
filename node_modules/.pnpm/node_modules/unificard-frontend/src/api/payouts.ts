// frontend/src/api/payouts.ts
// API client para Payout Engine
// 🔴 BLINDAGEM: Frontend apenas reflete backend, não calcula

import { apiFetch, apiFetchJson } from './client';

/**
 * Status do payout
 */
export type PayoutStatus = 'PENDING' | 'READY' | 'BLOCKED' | 'EXECUTED' | 'FAILED';

/**
 * Método de payout
 */
export type PayoutMethod = 'MANUAL' | 'BANK_TRANSFER' | 'PIX' | 'FUTURE_PROVIDER';

/**
 * Payout Batch
 */
export interface PayoutBatch {
  batchId: string;
  tenantId: string;
  status: PayoutStatus;
  totalAmountCents: number;
  currency: string;
  orderCount: number;
  executedCount: number;
  failedCount: number;
  blockedCount: number;
  evidencePackId: string;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  executedAt: string | null;
}

/**
 * Payout Order
 */
export interface PayoutOrder {
  orderId: string;
  tenantId: string;
  batchId: string | null;
  actorId: string;
  amountCents: number;
  currency: string;
  status: PayoutStatus;
  payoutMethod: PayoutMethod;
  ledgerEntryIds: string[];
  escrowId: string | null;
  agreementId: string | null;
  evidencePackId: string;
  blockReason: string | null;
  executionMetadata: Record<string, any> | null;
  failureReason: string | null;
  executedAt: string | null;
  failedAt: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar payout batch
 */
export interface CreatePayoutBatchInput {
  actorIds?: string[];
  startDate?: string;
  endDate?: string;
  minAmountCents?: number;
  currency?: string;
  payoutMethod?: PayoutMethod;
}

/**
 * Input para executar payout manual
 */
export interface ExecutePayoutManualInput {
  executedByActorId: string;
  executedByUserId?: string | null;
  executionMetadata?: Record<string, any>;
}

/**
 * Input para marcar payout como falho
 */
export interface FailPayoutInput {
  failedByActorId: string;
  failedByUserId?: string | null;
  failureReason: string;
}

/**
 * Lista payout batches
 */
export async function listPayoutBatches(filters: {
  status?: PayoutStatus;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<PayoutBatch[]> {
  const queryParams = new URLSearchParams();
  if (filters.status) queryParams.append('status', filters.status);
  if (filters.startDate) queryParams.append('startDate', filters.startDate);
  if (filters.endDate) queryParams.append('endDate', filters.endDate);
  if (filters.limit) queryParams.append('limit', filters.limit.toString());
  if (filters.offset) queryParams.append('offset', filters.offset.toString());

  const data = await apiFetchJson<{ batches: PayoutBatch[] }>(`/payouts/batches?${queryParams.toString()}`);
  return data.batches;
}

/**
 * Busca payout batch por ID
 */
export async function getPayoutBatch(batchId: string): Promise<PayoutBatch> {
  return apiFetchJson<PayoutBatch>(`/payouts/batches/${batchId}`);
}

/**
 * Lista payout orders
 */
export async function listPayoutOrders(filters: {
  batchId?: string;
  actorId?: string;
  status?: PayoutStatus;
  payoutMethod?: PayoutMethod;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<PayoutOrder[]> {
  const queryParams = new URLSearchParams();
  if (filters.batchId) queryParams.append('batchId', filters.batchId);
  if (filters.actorId) queryParams.append('actorId', filters.actorId);
  if (filters.status) queryParams.append('status', filters.status);
  if (filters.payoutMethod) queryParams.append('payoutMethod', filters.payoutMethod);
  if (filters.startDate) queryParams.append('startDate', filters.startDate);
  if (filters.endDate) queryParams.append('endDate', filters.endDate);
  if (filters.limit) queryParams.append('limit', filters.limit.toString());
  if (filters.offset) queryParams.append('offset', filters.offset.toString());

  const data = await apiFetchJson<{ orders: PayoutOrder[] }>(`/payouts/orders?${queryParams.toString()}`);
  return data.orders;
}

/**
 * Busca payout order por ID
 */
export async function getPayoutOrder(orderId: string): Promise<PayoutOrder> {
  return apiFetchJson<PayoutOrder>(`/payouts/orders/${orderId}`);
}

/**
 * Cria payout batch
 */
export async function createPayoutBatch(input: CreatePayoutBatchInput): Promise<{ batch: PayoutBatch; orders: PayoutOrder[] }> {
  const response = await apiFetch('/payouts/batches', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao criar payout batch' }));
    throw new Error(error.error || 'Erro ao criar payout batch');
  }

  return response.json();
}

/**
 * Executa payout manual
 */
export async function executePayoutManual(orderId: string, input: ExecutePayoutManualInput): Promise<PayoutOrder> {
  const response = await apiFetch(`/payouts/orders/${orderId}/execute-manual`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao executar payout' }));
    throw new Error(error.error || 'Erro ao executar payout');
  }

  const data = await response.json();
  return data.order;
}

/**
 * Marca payout como falho
 */
export async function markPayoutAsFailed(orderId: string, input: FailPayoutInput): Promise<PayoutOrder> {
  const response = await apiFetch(`/payouts/orders/${orderId}/fail`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao marcar payout como falho' }));
    throw new Error(error.error || 'Erro ao marcar payout como falho');
  }

  const data = await response.json();
  return data.order;
}




