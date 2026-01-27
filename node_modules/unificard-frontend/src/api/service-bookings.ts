// frontend/src/api/service-bookings.ts
// API Client para Service Bookings
// SPRINT: Services MVP

import { apiFetch } from './client';

export type BookingStatus = 'requested' | 'cancelled' | 'expired';

export interface ServiceBooking {
  bookingId: string;
  tenantId: string;
  serviceId: string;
  availabilityId: string;
  requesterActorId: string;
  status: BookingStatus;
  requestedAt: string; // ISO 8601
  notes: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  expiredAt: string | null;
}

export interface CreateBookingInput {
  serviceId: string;
  availabilityId: string;
  requesterActorId: string;
  notes?: string | null;
  metadata?: Record<string, any>;
}

export interface UpdateBookingInput {
  status?: BookingStatus;
  notes?: string | null;
  metadata?: Record<string, any>;
}

export interface BookingFilters {
  status?: BookingStatus;
}

/**
 * Criar booking para um serviço
 */
export async function createServiceBooking(serviceId: string, input: CreateBookingInput): Promise<ServiceBooking> {
  const response = await apiFetch(`/services/${serviceId}/bookings`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao criar reserva' }));
    throw new Error(error.error || 'Erro ao criar reserva');
  }
  const result = await response.json();
  return result.data;
}

/**
 * Listar bookings de um serviço
 */
export async function listServiceBookings(serviceId: string, filters?: BookingFilters): Promise<ServiceBooking[]> {
  const queryParams = new URLSearchParams();
  if (filters?.status) queryParams.append('status', filters.status);

  const query = queryParams.toString();
  const response = await apiFetch(`/services/${serviceId}/bookings${query ? `?${query}` : ''}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao listar reservas' }));
    throw new Error(error.error || 'Erro ao listar reservas');
  }
  const result = await response.json();
  return result.data || [];
}

/**
 * Listar bookings de um actor (requester)
 */
export async function listActorBookings(actorId: string, filters?: BookingFilters): Promise<ServiceBooking[]> {
  const queryParams = new URLSearchParams();
  if (filters?.status) queryParams.append('status', filters.status);

  const query = queryParams.toString();
  const response = await apiFetch(`/actors/${actorId}/bookings${query ? `?${query}` : ''}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao listar reservas do actor' }));
    throw new Error(error.error || 'Erro ao listar reservas do actor');
  }
  const result = await response.json();
  return result.data || [];
}

/**
 * Atualizar booking
 */
export async function updateServiceBooking(
  serviceId: string,
  bookingId: string,
  input: UpdateBookingInput
): Promise<ServiceBooking> {
  const response = await apiFetch(`/services/${serviceId}/bookings/${bookingId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao atualizar reserva' }));
    throw new Error(error.error || 'Erro ao atualizar reserva');
  }
  const result = await response.json();
  return result.data;
}

