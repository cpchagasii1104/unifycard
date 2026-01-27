// src/api/pdv.ts
// API do PDV (Ponto de Venda)
import { apiFetch, apiFetchJson } from './client';

// ============================================================
// SESSÕES PDV
// ============================================================

export interface PdvSession {
  id: string;
  tenantId: string;
  actorId: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export async function openPdvSession(input: {
  actorId?: string;
  metadata?: Record<string, any>;
}): Promise<PdvSession> {
  return apiFetchJson('/pdv/sessions/open', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function closePdvSession(sessionId: string, metadata?: Record<string, any>): Promise<PdvSession> {
  return apiFetchJson(`/pdv/sessions/${sessionId}/close`, {
    method: 'POST',
    body: JSON.stringify({ metadata }),
  });
}

export async function getOpenPdvSession(): Promise<PdvSession | null> {
  try {
    const response = await apiFetch('/pdv/sessions/open');
    const data = await response.json();
    return data.session || null;
  } catch (error: any) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function listPdvSessions(): Promise<PdvSession[]> {
  const response = await apiFetch('/pdv/sessions');
  const data = await response.json();
  return data.sessions || [];
}

// ============================================================
// FECHAMENTO DE CAIXA E RELATÓRIO
// ============================================================

export interface PdvSessionSummary {
  session: PdvSession;
  operator: {
    actorId: string;
  };
  openedAt: string;
  closedAt: string | null;
  totalOrders: number;
  totalPaid: number;
  totalFailed: number;
  orders: Array<{
    id: string;
    status: string;
    amount: number | null;
    paymentStatus: 'SUCCESS' | 'FAILED' | 'PENDING' | 'NONE';
    createdAt: string;
  }>;
}

export async function getSessionSummary(sessionId: string): Promise<PdvSessionSummary> {
  return apiFetchJson(`/pdv/sessions/${sessionId}/summary`);
}

export async function closeSessionWithSummary(sessionId: string): Promise<PdvSessionSummary> {
  return apiFetchJson(`/pdv/sessions/${sessionId}/close-with-summary`, {
    method: 'POST',
  });
}

// ============================================================
// PEDIDOS DO PDV
// ============================================================

export interface CreateOrderFromPdvInput {
  sessionId: string;
  buyerActorId: string;
  sellerActorId: string;
  metadata?: Record<string, any>;
}

export interface AddItemByVariantInput {
  sessionId: string;
  orderId: string;
  variantId: string;
  quantity: number;
  unit?: string;
}

export interface AddItemByWeightInput {
  sessionId: string;
  orderId: string;
  variantId: string;
  weight: number;
  unit?: string;
}

export async function createOrderFromPdv(input: CreateOrderFromPdvInput) {
  return apiFetchJson('/pdv/orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function addItemByVariant(input: AddItemByVariantInput) {
  return apiFetchJson(`/pdv/orders/${input.orderId}/items/unit`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function addItemByWeight(input: AddItemByWeightInput) {
  return apiFetchJson(`/pdv/orders/${input.orderId}/items/weight`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ============================================================
// PAGAMENTO NO PDV
// ============================================================

export interface PayOrderFromPdvInput {
  sessionId: string;
  orderId: string;
  amount: number;
  currency?: string;
  buyerActorId: string;
  sellerActorId: string;
  idempotencyKey?: string;
}

export interface PayOrderFromPdvResult {
  order: any;
  paymentIntent: any;
  transaction: any;
}

export async function payOrderFromPdv(input: PayOrderFromPdvInput): Promise<PayOrderFromPdvResult> {
  const headers: Record<string, string> = {};
  if (input.idempotencyKey) {
    headers['Idempotency-Key'] = input.idempotencyKey;
  }
  return apiFetchJson(`/pdv/orders/${input.orderId}/pay`, {
    method: 'POST',
    body: JSON.stringify(input),
    headers,
  });
}

