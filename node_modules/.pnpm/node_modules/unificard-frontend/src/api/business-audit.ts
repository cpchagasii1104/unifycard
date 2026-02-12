// frontend/src/api/business-audit.ts
// API Client para Auditoria de Negócio

import { apiFetch } from './client';

export type BusinessAuditAction =
  | 'booking_requested'
  | 'booking_decided'
  | 'booking_confirmed'
  | 'rfq_created'
  | 'quote_submitted'
  | 'rfq_converted'
  | 'bundle_confirmed'
  | 'financial_terms_confirmed'
  | 'service_order_created'
  | 'service_order_confirmed'
  | 'service_order_started'
  | 'service_order_completed'
  | 'service_order_cancelled';

export type BusinessAuditContextType = 'event' | 'rfq' | 'booking' | 'service_order' | 'bundle' | 'split';

export interface BusinessAuditLog {
  logId: string;
  tenantId: string;
  action: BusinessAuditAction;
  actorId: string;
  userId?: string | null;
  contextType: BusinessAuditContextType;
  contextId: string;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

/**
 * Listar logs de auditoria
 */
export async function listBusinessAuditLogs(filters?: {
  actorId?: string;
  action?: BusinessAuditAction;
  contextType?: BusinessAuditContextType;
  contextId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: BusinessAuditLog[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.actorId) params.append('actorId', filters.actorId);
  if (filters?.action) params.append('action', filters.action);
  if (filters?.contextType) params.append('contextType', filters.contextType);
  if (filters?.contextId) params.append('contextId', filters.contextId);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.offset) params.append('offset', filters.offset.toString());

  const response = await apiFetch(`/business-audit-logs?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao listar logs de auditoria' }));
    throw new Error(error.error || 'Erro ao listar logs de auditoria');
  }

  return response.json();
}

/**
 * Buscar log por ID
 */
export async function getBusinessAuditLog(logId: string): Promise<BusinessAuditLog> {
  const response = await apiFetch(`/business-audit-logs/${logId}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao buscar log de auditoria' }));
    throw new Error(error.error || 'Erro ao buscar log de auditoria');
  }

  return response.json();
}




