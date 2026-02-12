// frontend/src/api/pilot.ts
// SPRINT 13: API para eventos de observação do modo piloto

import { apiFetch } from './client';
import type { PilotEventType } from '../services/pilot-observer.service';

// Re-export for convenience
export type { PilotEventType } from '../services/pilot-observer.service';

export interface PilotEvent {
  eventId: string;
  tenantId: string;
  eventType: PilotEventType;
  actorId: string;
  actorType: 'user' | 'page' | 'group' | 'company';
  occurredAt: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

/**
 * Lista eventos de observação
 */
export async function listPilotEvents(options?: {
  limit?: number;
  offset?: number;
  eventType?: PilotEventType;
}): Promise<PilotEvent[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  if (options?.eventType) params.append('eventType', options.eventType);

  const response = await apiFetch(`/admin/pilot/events?${params.toString()}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erro ao listar eventos de piloto');
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Conta eventos de observação
 */
export async function countPilotEvents(eventType?: PilotEventType): Promise<number> {
  const params = new URLSearchParams();
  if (eventType) params.append('eventType', eventType);

  const response = await apiFetch(`/admin/pilot/events/count?${params.toString()}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erro ao contar eventos de piloto');
  }

  const data = await response.json();
  return data.data?.count || 0;
}







