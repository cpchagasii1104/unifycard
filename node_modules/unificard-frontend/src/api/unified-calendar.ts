// frontend/src/api/unified-calendar.ts
// API client para AGENDA UNIFICADA

import { apiFetch } from './client';

/**
 * Fonte da entrada de agenda
 */
export enum CalendarEntrySource {
  SERVICE_AVAILABILITY = 'service_availability',
  CALENDAR_EVENT = 'calendar_event',
  UNIFIED_AVAILABILITY = 'unified_availability',
  EVENT = 'event',
}

/**
 * Tipo de entrada de agenda
 */
export enum CalendarEntryType {
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  BLOCKED = 'blocked',
  UNAVAILABLE = 'unavailable',
}

/**
 * Entrada Unificada de Agenda
 */
export interface UnifiedCalendarEntry {
  id: string;
  source: CalendarEntrySource;
  sourceId: string;
  type: CalendarEntryType;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  timezone: string;
  title: string;
  description?: string | null;
  actorId?: string | null;
  serviceId?: string | null;
  eventId?: string | null;
  serviceOrderId?: string | null;
  availabilityId?: string | null;
  locationAddress?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  sourceStatus?: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Filtros para buscar agenda unificada
 */
export interface UnifiedCalendarFilters {
  actorId?: string;
  serviceId?: string;
  eventId?: string;
  source?: CalendarEntrySource;
  type?: CalendarEntryType;
  startTimeFrom?: string; // ISO 8601
  startTimeTo?: string; // ISO 8601
  limit?: number;
  offset?: number;
}

/**
 * Busca agenda unificada
 */
export async function getUnifiedCalendar(
  filters?: UnifiedCalendarFilters
): Promise<UnifiedCalendarEntry[]> {
  const queryParams = new URLSearchParams();
  
  if (filters?.actorId) queryParams.append('actorId', filters.actorId);
  if (filters?.serviceId) queryParams.append('serviceId', filters.serviceId);
  if (filters?.eventId) queryParams.append('eventId', filters.eventId);
  if (filters?.source) queryParams.append('source', filters.source);
  if (filters?.type) queryParams.append('type', filters.type);
  if (filters?.startTimeFrom) queryParams.append('startTimeFrom', filters.startTimeFrom);
  if (filters?.startTimeTo) queryParams.append('startTimeTo', filters.startTimeTo);
  if (filters?.limit) queryParams.append('limit', filters.limit.toString());
  if (filters?.offset) queryParams.append('offset', filters.offset.toString());

  const response = await apiFetch(`/unified-calendar?${queryParams.toString()}`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao buscar agenda unificada' }));
    throw new Error(error.error || 'Erro ao buscar agenda unificada');
  }

  const data = await response.json();
  return data.entries || [];
}




