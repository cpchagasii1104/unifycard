// frontend/src/api/service-bundles.ts
// API client para SERVIÇOS COMBINADOS (Bundles)

import { apiFetch } from './client';

/**
 * Tipo de dependência entre serviços no bundle
 */
export enum BundleDependencyType {
  SAME_TIME = 'same_time',
  SAME_LOCATION = 'same_location',
  PRIMARY_SECONDARY = 'primary_secondary',
}

/**
 * Input para criar bundle bookings
 */
export interface CreateBundleBookingInput {
  bundleId?: string;
  serviceIds: string[];
  availabilityIds: string[];
  requesterActorId: string;
  scheduledStart: string; // ISO 8601
  scheduledEnd: string; // ISO 8601
  locationAddress?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  notes?: string | null;
  dependencyType: BundleDependencyType;
  metadata?: Record<string, any>;
}

/**
 * Resultado da criação de bundle bookings
 */
export interface BundleBookingResult {
  bundleId: string;
  bookings: Array<{
    bookingId: string;
    serviceId: string;
    availabilityId: string;
    status: string;
  }>;
  canConfirm: boolean;
}

/**
 * Input para confirmar bundle
 */
export interface ConfirmBundleInput {
  bundleId: string;
  bookingIds: string[];
  decisionIds: string[];
}

/**
 * Resultado da confirmação de bundle
 */
export interface ConfirmBundleResult {
  bundleId: string;
  serviceOrders: Array<{
    orderId: string;
    serviceId: string;
    bookingId: string;
    status: string;
  }>;
  calendarEvents: Array<{
    eventId: string;
    serviceOrderId: string;
  }>;
}

/**
 * Cria bundle bookings de forma atômica
 */
export async function createBundleBookings(
  input: CreateBundleBookingInput
): Promise<BundleBookingResult> {
  const response = await apiFetch('/service-bundles/book', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao criar bundle bookings' }));
    throw new Error(error.error || 'Erro ao criar bundle bookings');
  }

  return response.json();
}

/**
 * Busca bookings de um bundle
 */
export async function getBundleBookings(bundleId: string): Promise<Array<{
  bookingId: string;
  serviceId: string;
  status: string;
}>> {
  const response = await apiFetch(`/service-bundles/${bundleId}/bookings`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao buscar bookings do bundle' }));
    throw new Error(error.error || 'Erro ao buscar bookings do bundle');
  }

  const data = await response.json();
  return data.bookings || [];
}

/**
 * Verifica se bundle pode ser confirmado
 */
export async function canConfirmBundle(bundleId: string): Promise<{
  canConfirm: boolean;
  reason?: string;
}> {
  const response = await apiFetch(`/service-bundles/${bundleId}/can-confirm`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao verificar bundle' }));
    throw new Error(error.error || 'Erro ao verificar bundle');
  }

  return response.json();
}

/**
 * Confirma bundle de forma atômica
 */
export async function confirmBundle(input: ConfirmBundleInput): Promise<ConfirmBundleResult> {
  const response = await apiFetch('/service-bundles/confirm', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao confirmar bundle' }));
    throw new Error(error.error || 'Erro ao confirmar bundle');
  }

  return response.json();
}

