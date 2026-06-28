// src/api/service-orders.ts
// API Client para Service Orders
// SPRINT 68: Service Orders + Agenda

import { apiFetch, apiFetchJson } from './client';

// 🔴 F-MVP-SERVICE-ORDERS-CLIENT-PREFIX-AND-BACK-UX-SLICE-A (DT-MVP-SERVICE-ORDERS-LIST-ROUTE-MISMATCH):
// o backend monta serviceOrderRoutes DENTRO do módulo de serviços (app.builder → register(servicesModule,
// { prefix: '/services' }) → services.module → register(serviceOrderRoutes) sem prefixo extra). Logo o
// contrato VIVO é '/services/service-orders' — não '/service-orders'. O client antigo omitia o '/services'
// e o app real devolvia 404 ("Route GET /service-orders ... not found"). Esta base é a única fonte do prefixo.
// (offerings.ts já segue o mesmo padrão '/services/offerings'.) NÃO montar rota raiz no backend.
const SERVICE_ORDERS_BASE = '/services/service-orders';

export type ServiceOrderStatus = 'DRAFT' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface ServiceOrder {
  id: string;
  tenantId: string;
  serviceId: string;
  workerActorId: string;
  customerActorId: string;
  bookingId: string | null;
  decisionId: string | null;
  status: ServiceOrderStatus;
  scheduledStart: string; // ISO 8601
  scheduledEnd: string | null; // ISO 8601
  estimatedDurationMinutes: number | null;
  locationAddress: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
  description: string | null;
  customerNotes: string | null;
  workerNotes: string | null;
  createdByActorId: string;
  createdByUserId: string | null;
  confirmedAt: string | null; // ISO 8601
  confirmedByActorId: string | null;
  startedAt: string | null; // ISO 8601
  completedAt: string | null; // ISO 8601
  cancelledAt: string | null; // ISO 8601
  cancellationReason: string | null;
  metadata: Record<string, any>;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface CreateServiceOrderInput {
  serviceId: string;
  workerActorId: string;
  customerActorId: string;
  bookingId?: string;
  scheduledStart: string; // ISO 8601
  scheduledEnd?: string; // ISO 8601
  estimatedDurationMinutes?: number;
  locationAddress?: string;
  locationLatitude?: number;
  locationLongitude?: number;
  description?: string;
  customerNotes?: string;
  metadata?: Record<string, any>;
}

export interface ServiceOrderFilters {
  serviceId?: string;
  workerActorId?: string;
  customerActorId?: string;
  status?: ServiceOrderStatus;
  scheduledStartFrom?: string; // ISO 8601
  scheduledStartTo?: string; // ISO 8601
  limit?: number;
  offset?: number;
}

/**
 * Criar nova ordem de serviço (status: DRAFT)
 */
export async function createServiceOrder(input: CreateServiceOrderInput): Promise<ServiceOrder> {
  const response = await apiFetch(SERVICE_ORDERS_BASE, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao criar ordem de serviço' }));
    throw new Error(error.error || 'Erro ao criar ordem de serviço');
  }

  return response.json();
}

/**
 * Listar ordens de serviço com filtros
 */
export async function listServiceOrders(filters?: ServiceOrderFilters): Promise<ServiceOrder[]> {
  const queryParams = new URLSearchParams();
  
  if (filters?.serviceId) queryParams.append('serviceId', filters.serviceId);
  if (filters?.workerActorId) queryParams.append('workerActorId', filters.workerActorId);
  if (filters?.customerActorId) queryParams.append('customerActorId', filters.customerActorId);
  if (filters?.status) queryParams.append('status', filters.status);
  if (filters?.scheduledStartFrom) queryParams.append('scheduledStartFrom', filters.scheduledStartFrom);
  if (filters?.scheduledStartTo) queryParams.append('scheduledStartTo', filters.scheduledStartTo);
  if (filters?.limit) queryParams.append('limit', filters.limit.toString());
  if (filters?.offset) queryParams.append('offset', filters.offset.toString());

  const queryString = queryParams.toString();
  const url = `${SERVICE_ORDERS_BASE}${queryString ? `?${queryString}` : ''}`;

  const response = await apiFetch(url);
  if (!response.ok) {
    throw new Error('Erro ao listar ordens de serviço');
  }

  const result = await response.json();
  return result.orders || [];
}

/**
 * Buscar ordem de serviço por ID
 */
export async function getServiceOrder(orderId: string): Promise<ServiceOrder> {
  const response = await apiFetch(`${SERVICE_ORDERS_BASE}/${orderId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Ordem de serviço não encontrada');
    }
    throw new Error('Erro ao buscar ordem de serviço');
  }

  return response.json();
}

/**
 * Confirmar ordem de serviço (DRAFT → CONFIRMED)
 * Cria Calendar Event automaticamente
 */
export async function confirmServiceOrder(
  orderId: string,
  confirmedByActorId: string,
  confirmedByUserId?: string
): Promise<ServiceOrder> {
  const response = await apiFetch(`${SERVICE_ORDERS_BASE}/${orderId}/confirm`, {
    method: 'POST',
    body: JSON.stringify({
      confirmedByActorId,
      confirmedByUserId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao confirmar ordem' }));
    throw new Error(error.error || 'Erro ao confirmar ordem de serviço');
  }

  return response.json();
}

/**
 * Iniciar ordem de serviço (CONFIRMED → IN_PROGRESS)
 */
export async function startServiceOrder(
  orderId: string,
  startedByActorId: string,
  startedByUserId?: string,
  workerNotes?: string
): Promise<ServiceOrder> {
  const response = await apiFetch(`${SERVICE_ORDERS_BASE}/${orderId}/start`, {
    method: 'POST',
    body: JSON.stringify({
      startedByActorId,
      startedByUserId,
      workerNotes,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao iniciar ordem' }));
    throw new Error(error.error || 'Erro ao iniciar ordem de serviço');
  }

  return response.json();
}

/**
 * Completar ordem de serviço (IN_PROGRESS → COMPLETED)
 */
export async function completeServiceOrder(
  orderId: string,
  completedByActorId: string,
  completedByUserId?: string,
  workerNotes?: string
): Promise<ServiceOrder> {
  const response = await apiFetch(`${SERVICE_ORDERS_BASE}/${orderId}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      completedByActorId,
      completedByUserId,
      workerNotes,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao completar ordem' }));
    throw new Error(error.error || 'Erro ao completar ordem de serviço');
  }

  return response.json();
}

/**
 * Cancelar ordem de serviço
 */
export async function cancelServiceOrder(
  orderId: string,
  cancelledByActorId: string,
  cancelledByUserId?: string,
  cancellationReason?: string
): Promise<ServiceOrder> {
  const response = await apiFetch(`${SERVICE_ORDERS_BASE}/${orderId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({
      cancelledByActorId,
      cancelledByUserId,
      cancellationReason,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao cancelar ordem' }));
    throw new Error(error.error || 'Erro ao cancelar ordem de serviço');
  }

  return response.json();
}

/**
 * Termos financeiros de uma Service Order
 */
export interface ServiceOrderFinancialTerms {
  serviceOrderId: string;
  grossAmount: number; // Valor bruto em centavos
  platformFeePercentage: number; // Percentual da comissão (ex: 3 = 3%)
  platformFee: number; // Valor da comissão em centavos
  providerNetAmount: number; // Valor líquido do prestador em centavos
  currency: string;
  providerActorId: string;
  platformActorId: string;
}

/**
 * Visualizar termos financeiros de uma Service Order
 * 
 * REGRAS:
 * - NÃO cria split
 * - NÃO executa pagamento
 * - Apenas retorna valores calculados para visualização
 */
export async function getServiceOrderFinancialTerms(
  orderId: string
): Promise<ServiceOrderFinancialTerms> {
  const response = await apiFetch(`${SERVICE_ORDERS_BASE}/${orderId}/financial-terms`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao buscar termos financeiros' }));
    throw new Error(error.error || 'Erro ao buscar termos financeiros');
  }

  return response.json();
}

/**
 * Confirmar termos financeiros criando split
 * 
 * REGRAS:
 * - NÃO executa pagamento
 * - NÃO move dinheiro automaticamente
 * - Apenas cria entidade de split para rastreabilidade
 * - Confirmação humana obrigatória
 */
export async function confirmServiceOrderFinancialTerms(
  orderId: string
): Promise<{ splits: any[] }> {
  const response = await apiFetch(`${SERVICE_ORDERS_BASE}/${orderId}/confirm-financial-terms`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao confirmar termos financeiros' }));
    throw new Error(error.error || 'Erro ao confirmar termos financeiros');
  }

  return response.json();
}

/**
 * Confirmar booking aceito criando Service Order
 * 
 * REGRAS:
 * - NÃO cria pagamento
 * - NÃO cria comissão
 * - NÃO cria split
 * - Bloqueia agenda explicitamente
 * - Status inicial: CONFIRMED
 */
export async function confirmBookingFromDecision(
  bookingId: string,
  decisionId: string
): Promise<ServiceOrder> {
  const response = await apiFetch(`${SERVICE_ORDERS_BASE}/confirm-booking`, {
    method: 'POST',
    body: JSON.stringify({
      bookingId,
      decisionId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao confirmar booking' }));
    throw new Error(error.error || 'Erro ao confirmar booking');
  }

  return response.json();
}

