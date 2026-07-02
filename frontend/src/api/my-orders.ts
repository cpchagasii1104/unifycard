// frontend/src/api/my-orders.ts
// API client para My Orders & Purchases Hub
// 🔴 BLINDAGEM: Frontend apenas reflete backend, não calcula

import { apiFetchJson } from './client';

/**
 * Tipo de pedido/ordem
 */
export type OrderType = 'rfq' | 'booking' | 'service_order' | 'agreement' | 'bundle';

/**
 * Status consolidado do pedido
 */
export type OrderStatus =
  | 'negotiation'
  | 'agreement_finalized'
  | 'in_execution'
  | 'completed'
  | 'cancelled'
  | 'disputed';

/**
 * Item unificado do My Orders Hub
 */
export interface MyOrderItem {
  orderId: string;
  orderType: OrderType;
  status: OrderStatus;
  serviceId: string | null;
  serviceName: string | null;
  eventId: string | null;
  eventName: string | null;
  agreedPriceCents: number | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  completedAt: string | null;
  bookingId: string | null;
  serviceOrderId: string | null;
  rfqId: string | null;
  agreementId: string | null;
  threadId: string | null;
  evidencePackId: string | null;
  invoiceId: string | null;
  hasOpenDispute: boolean;
  trustScore: number | null;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED' | null;
  metadata: Record<string, any>;
}

/**
 * Estatísticas do My Orders Hub
 */
export interface MyOrdersStats {
  totalOrders: number;
  ordersByStatus: Record<OrderStatus, number>;
  ordersByType: Record<OrderType, number>;
  totalValueCents: number;
  currency: string;
  openDisputes: number;
}

/**
 * Filtros para buscar pedidos
 */
export interface MyOrdersFilters {
  orderType?: OrderType;
  status?: OrderStatus;
  startDate?: string;
  endDate?: string;
  hasOpenDispute?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Lista todos os pedidos do comprador
 */
export async function listMyOrders(filters: MyOrdersFilters = {}): Promise<MyOrderItem[]> {
  const queryParams = new URLSearchParams();
  if (filters.orderType) queryParams.append('orderType', filters.orderType);
  if (filters.status) queryParams.append('status', filters.status);
  if (filters.startDate) queryParams.append('startDate', filters.startDate);
  if (filters.endDate) queryParams.append('endDate', filters.endDate);
  if (filters.hasOpenDispute !== undefined) queryParams.append('hasOpenDispute', filters.hasOpenDispute.toString());
  if (filters.limit) queryParams.append('limit', filters.limit.toString());
  if (filters.offset) queryParams.append('offset', filters.offset.toString());

  const data = await apiFetchJson<{ orders: MyOrderItem[] }>(`/api/my-orders?${queryParams.toString()}`);
  return data.orders;
}

/**
 * Busca estatísticas do My Orders Hub
 */
export async function getMyOrdersStats(): Promise<MyOrdersStats> {
  const data = await apiFetchJson<{ stats: MyOrdersStats }>('/api/my-orders/stats');
  return data.stats;
}




