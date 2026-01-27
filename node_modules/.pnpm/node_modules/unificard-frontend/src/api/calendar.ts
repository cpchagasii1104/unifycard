// src/api/calendar.ts
// API Client para Calendar Events
// SPRINT 68: Service Orders + Agenda

import { apiFetch, apiFetchJson } from './client';

export type CalendarEventType = 'SERVICE_ORDER' | 'BLOCK' | 'UNAVAILABLE' | 'OTHER';
export type CalendarEventStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface CalendarEvent {
  id: string;
  tenantId: string;
  actorId: string; // Worker/owner da agenda
  serviceOrderId: string | null;
  eventType: CalendarEventType;
  status: CalendarEventStatus;
  title: string;
  description: string | null;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  locationAddress: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
  createdByActorId: string;
  createdByUserId: string | null;
  startedAt: string | null; // ISO 8601
  completedAt: string | null; // ISO 8601
  cancelledAt: string | null; // ISO 8601
  cancellationReason: string | null;
  metadata: Record<string, any>;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface CreateCalendarEventInput {
  actorId: string;
  serviceOrderId?: string;
  eventType: CalendarEventType;
  title: string;
  description?: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  locationAddress?: string;
  locationLatitude?: number;
  locationLongitude?: number;
  metadata?: Record<string, any>;
}

export interface CheckAvailabilityInput {
  actorId: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  excludeEventId?: string;
}

export interface AvailabilityCheckResult {
  available: boolean;
  conflictingEvents: Array<{
    id: string;
    title: string;
    startTime: string; // ISO 8601
    endTime: string; // ISO 8601
    eventType: CalendarEventType;
  }>;
}

export interface CalendarEventFilters {
  actorId?: string;
  serviceOrderId?: string;
  eventType?: CalendarEventType;
  status?: CalendarEventStatus;
  startTimeFrom?: string; // ISO 8601
  startTimeTo?: string; // ISO 8601
  limit?: number;
  offset?: number;
}

/**
 * Criar evento de agenda
 */
export async function createCalendarEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
  const response = await apiFetch('/calendar/events', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao criar evento' }));
    throw new Error(error.error || 'Erro ao criar evento de agenda');
  }

  return response.json();
}

/**
 * Listar eventos de agenda com filtros
 */
export async function listCalendarEvents(filters?: CalendarEventFilters): Promise<CalendarEvent[]> {
  const queryParams = new URLSearchParams();
  
  if (filters?.actorId) queryParams.append('actorId', filters.actorId);
  if (filters?.serviceOrderId) queryParams.append('serviceOrderId', filters.serviceOrderId);
  if (filters?.eventType) queryParams.append('eventType', filters.eventType);
  if (filters?.status) queryParams.append('status', filters.status);
  if (filters?.startTimeFrom) queryParams.append('startTimeFrom', filters.startTimeFrom);
  if (filters?.startTimeTo) queryParams.append('startTimeTo', filters.startTimeTo);
  if (filters?.limit) queryParams.append('limit', filters.limit.toString());
  if (filters?.offset) queryParams.append('offset', filters.offset.toString());

  const queryString = queryParams.toString();
  const url = `/calendar/events${queryString ? `?${queryString}` : ''}`;

  const response = await apiFetch(url);
  if (!response.ok) {
    throw new Error('Erro ao listar eventos de agenda');
  }

  const result = await response.json();
  return result.events || [];
}

/**
 * Buscar evento de agenda por ID
 */
export async function getCalendarEvent(eventId: string): Promise<CalendarEvent> {
  const response = await apiFetch(`/calendar/events/${eventId}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Evento de agenda não encontrado');
    }
    throw new Error('Erro ao buscar evento de agenda');
  }

  return response.json();
}

/**
 * Verificar disponibilidade (conflitos de horário)
 */
export async function checkAvailability(input: CheckAvailabilityInput): Promise<AvailabilityCheckResult> {
  const response = await apiFetch('/calendar/availability/check', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao verificar disponibilidade' }));
    throw new Error(error.error || 'Erro ao verificar disponibilidade');
  }

  return response.json();
}




