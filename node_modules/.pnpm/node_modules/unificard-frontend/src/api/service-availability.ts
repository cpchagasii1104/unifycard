// frontend/src/api/service-availability.ts
// API Client para Service Availability
// SPRINT: Services MVP

import { apiFetch } from './client';

export type AvailabilityType = 'fixed' | 'recurring' | 'on_demand';
export type AvailabilityStatus = 'active' | 'paused';

export interface ServiceAvailability {
  id: string;
  tenantId: string;
  serviceId: string;
  availabilityType: AvailabilityType;
  status: AvailabilityStatus;
  startDatetime: string; // ISO 8601
  endDatetime: string; // ISO 8601
  timezone: string;
  capacity: number | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAvailabilityInput {
  serviceId: string;
  availabilityType?: AvailabilityType;
  status?: AvailabilityStatus;
  startDatetime: string; // ISO 8601
  endDatetime: string; // ISO 8601
  timezone?: string;
  capacity?: number | null;
  metadata?: Record<string, any>;
}

export interface UpdateAvailabilityInput {
  availabilityType?: AvailabilityType;
  status?: AvailabilityStatus;
  startDatetime?: string; // ISO 8601
  endDatetime?: string; // ISO 8601
  timezone?: string;
  capacity?: number | null;
  metadata?: Record<string, any>;
}

export interface AvailabilityFilters {
  status?: AvailabilityStatus;
}

/**
 * Criar disponibilidade para um serviço
 */
export async function createServiceAvailability(serviceId: string, input: CreateAvailabilityInput): Promise<ServiceAvailability> {
  const response = await apiFetch(`/services/${serviceId}/availability`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao criar disponibilidade' }));
    throw new Error(error.error || 'Erro ao criar disponibilidade');
  }
  const result = await response.json();
  return result.data;
}

/**
 * Listar disponibilidades de um serviço
 */
export async function listServiceAvailabilities(serviceId: string, filters?: AvailabilityFilters): Promise<ServiceAvailability[]> {
  const queryParams = new URLSearchParams();
  if (filters?.status) queryParams.append('status', filters.status);

  const query = queryParams.toString();
  const response = await apiFetch(`/services/${serviceId}/availability${query ? `?${query}` : ''}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao listar disponibilidades' }));
    throw new Error(error.error || 'Erro ao listar disponibilidades');
  }
  const result = await response.json();
  return result.data || [];
}

/**
 * Atualizar disponibilidade
 */
export async function updateServiceAvailability(
  serviceId: string,
  availabilityId: string,
  input: UpdateAvailabilityInput
): Promise<ServiceAvailability> {
  const response = await apiFetch(`/services/${serviceId}/availability/${availabilityId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao atualizar disponibilidade' }));
    throw new Error(error.error || 'Erro ao atualizar disponibilidade');
  }
  const result = await response.json();
  return result.data;
}




