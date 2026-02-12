// frontend/src/api/service-booking-decisions.ts
// API Client para Decisões de Service Booking
// SPRINT: Visão do Prestador

import { apiFetch } from './client';

export type BookingDecisionStatus = 'accepted' | 'rejected';

export interface ServiceBookingDecision {
  decisionId: string;
  tenantId: string;
  bookingId: string;
  decidedByActorId: string;
  status: BookingDecisionStatus;
  decidedAt: string; // ISO 8601
  reason: string | null;
  metadata: Record<string, any>;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface CreateBookingDecisionInput {
  bookingId: string;
  decidedByActorId: string;
  status: BookingDecisionStatus;
  reason?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Criar decisão para um booking
 */
export async function createBookingDecision(
  serviceId: string,
  bookingId: string,
  input: CreateBookingDecisionInput
): Promise<ServiceBookingDecision> {
  const response = await apiFetch(`/services/${serviceId}/bookings/${bookingId}/decision`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao criar decisão' }));
    throw new Error(error.error || 'Erro ao criar decisão');
  }
  const result = await response.json();
  return result.data;
}

/**
 * Buscar decisão de um booking
 */
export async function getBookingDecision(
  serviceId: string,
  bookingId: string
): Promise<ServiceBookingDecision | null> {
  const response = await apiFetch(`/services/${serviceId}/bookings/${bookingId}/decision`);
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const error = await response.json().catch(() => ({ error: 'Erro ao buscar decisão' }));
    throw new Error(error.error || 'Erro ao buscar decisão');
  }
  const result = await response.json();
  return result.data;
}




