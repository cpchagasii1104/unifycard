// frontend/src/api/automation.ts
// SPRINT 50: API client para automações e alertas

import { apiFetch } from './client';

export type AlertType =
  | 'INVENTORY_LOW_STOCK'
  | 'INVENTORY_OUT_OF_STOCK'
  | 'PAYMENT_FAILED'
  | 'PAYOUT_FAILED'
  | 'FISCAL_PENDING'
  | 'ORDER_EXPIRED'
  | 'RESERVATION_EXPIRED'
  | 'OTHER';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AlertStatus = 'OPEN' | 'ACK' | 'RESOLVED';

export interface Alert {
  id: string;
  tenantId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  entityType: string | null;
  entityId: string | null;
  status: AlertStatus;
  metadata: Record<string, any> | null;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  updatedAt: string;
}

export interface AlertFilters {
  type?: AlertType;
  severity?: AlertSeverity;
  status?: AlertStatus;
  entityType?: string;
  entityId?: string;
  limit?: number;
  offset?: number;
}

export interface UpdateAlertStatusInput {
  status: AlertStatus;
  reason?: string;
}

/**
 * Lista alertas
 */
export async function listAlerts(filters?: AlertFilters): Promise<{ alerts: Alert[] }> {
  const params = new URLSearchParams();
  if (filters?.type) params.append('type', filters.type);
  if (filters?.severity) params.append('severity', filters.severity);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.entityType) params.append('entityType', filters.entityType);
  if (filters?.entityId) params.append('entityId', filters.entityId);
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.offset) params.append('offset', filters.offset.toString());

  const query = params.toString();
  const response = await apiFetch(`/automation/alerts${query ? `?${query}` : ''}`);
  return response.json();
}

/**
 * Conta alertas abertos
 */
export async function countOpenAlerts(severity?: AlertSeverity): Promise<{ count: number }> {
  const params = new URLSearchParams();
  if (severity) params.append('severity', severity);

  const query = params.toString();
  const response = await apiFetch(`/automation/alerts/count${query ? `?${query}` : ''}`);
  return response.json();
}

/**
 * Busca alerta por ID
 */
export async function getAlertById(alertId: string): Promise<Alert> {
  const response = await apiFetch(`/automation/alerts/${alertId}`);
  return response.json();
}

/**
 * Atualiza status do alerta
 */
export async function updateAlertStatus(
  alertId: string,
  input: UpdateAlertStatusInput
): Promise<Alert> {
  const response = await apiFetch(`/automation/alerts/${alertId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return response.json();
}







