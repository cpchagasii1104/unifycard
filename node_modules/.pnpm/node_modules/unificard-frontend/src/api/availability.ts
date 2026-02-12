// src/api/availability.ts
// Client API para Unified Availability
// Integra frontend com backend Unified Availability Core

import { apiFetchJson } from './client';

/**
 * Tipo de owner da disponibilidade
 */
export type AvailabilityOwnerType = 'user' | 'service' | 'event' | 'group';

/**
 * Tipo de disponibilidade
 */
export type UnifiedAvailabilityType = 'fixed' | 'recurring' | 'on_demand';

/**
 * Status da disponibilidade
 */
export type UnifiedAvailabilityStatus = 'active' | 'paused' | 'cancelled';

/**
 * Status do booking
 */
export type UnifiedBookingStatus = 'requested' | 'confirmed' | 'cancelled' | 'expired';

/**
 * Papel do participante
 */
export type ParticipantRole = 'executor' | 'participant' | 'guest';

/**
 * Disponibilidade unificada
 */
export interface UnifiedAvailability {
  availabilityId: string;
  tenantId: string;
  ownerType: AvailabilityOwnerType;
  ownerId: string;
  availabilityType: UnifiedAvailabilityType;
  status: UnifiedAvailabilityStatus;
  startDatetime: string; // ISO 8601
  endDatetime: string; // ISO 8601
  timezone: string;
  capacity: number | null;
  metadata: Record<string, any>;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * Booking unificado
 */
export interface UnifiedBooking {
  bookingId: string;
  tenantId: string;
  availabilityId: string;
  requesterActorId: string;
  status: UnifiedBookingStatus;
  requestedAt: string; // ISO 8601
  notes: string | null;
  checkedInAt: string | null; // ISO 8601
  checkedOutAt: string | null; // ISO 8601
  metadata: Record<string, any>;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  cancelledAt: string | null; // ISO 8601
  expiredAt: string | null; // ISO 8601
  confirmedAt: string | null; // ISO 8601
}

/**
 * Participante de disponibilidade
 */
export interface AvailabilityParticipant {
  participantId: string;
  tenantId: string;
  availabilityId: string;
  actorId: string;
  role: ParticipantRole;
  metadata: Record<string, any>;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * Conflito de disponibilidade (alerta)
 */
export interface AvailabilityConflict {
  conflictingAvailabilityId: string;
  conflictingOwnerType: AvailabilityOwnerType;
  conflictingOwnerId: string;
  conflictingStartDatetime: string; // ISO 8601
  conflictingEndDatetime: string; // ISO 8601
  conflictType: string;
}

/**
 * Listar disponibilidades com filtros
 * 
 * @param filters Filtros de busca
 * @returns Lista de disponibilidades
 */
export async function listAvailabilities(filters?: {
  ownerType?: AvailabilityOwnerType;
  ownerId?: string;
  status?: UnifiedAvailabilityStatus;
  startDatetime?: string;
  endDatetime?: string;
}): Promise<UnifiedAvailability[]> {
  const queryParams = new URLSearchParams();
  if (filters?.ownerType) queryParams.append('ownerType', filters.ownerType);
  if (filters?.ownerId) queryParams.append('ownerId', filters.ownerId);
  if (filters?.status) queryParams.append('status', filters.status);
  if (filters?.startDatetime) queryParams.append('startDatetime', filters.startDatetime);
  if (filters?.endDatetime) queryParams.append('endDatetime', filters.endDatetime);
  
  const result = await apiFetchJson<{ ok: boolean; data: UnifiedAvailability[] }>(
    `/availability?${queryParams.toString()}`
  );
  
  if (!result.ok || !result.data) {
    return [];
  }
  
  return result.data;
}

/**
 * Criar nova disponibilidade
 * 
 * @param input Dados da disponibilidade
 * @returns Disponibilidade criada
 */
export async function createAvailability(input: {
  ownerType: AvailabilityOwnerType;
  ownerId: string;
  availabilityType?: UnifiedAvailabilityType;
  status?: UnifiedAvailabilityStatus;
  startDatetime: string; // ISO 8601
  endDatetime: string; // ISO 8601
  timezone?: string;
  capacity?: number | null;
  metadata?: Record<string, any>;
}): Promise<UnifiedAvailability> {
  const result = await apiFetchJson<{ ok: boolean; data: UnifiedAvailability }>(
    '/availability',
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
  
  if (!result.ok || !result.data) {
    throw new Error('Erro ao criar disponibilidade');
  }
  
  return result.data;
}

/**
 * Atualizar disponibilidade
 * 
 * @param availabilityId ID da disponibilidade
 * @param input Dados para atualizar
 * @returns Disponibilidade atualizada
 */
export async function updateAvailability(
  availabilityId: string,
  input: {
    availabilityType?: UnifiedAvailabilityType;
    status?: UnifiedAvailabilityStatus;
    startDatetime?: string; // ISO 8601
    endDatetime?: string; // ISO 8601
    timezone?: string;
    capacity?: number | null;
    metadata?: Record<string, any>;
  }
): Promise<UnifiedAvailability> {
  const result = await apiFetchJson<{ ok: boolean; data: UnifiedAvailability }>(
    `/availability/${availabilityId}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    }
  );
  
  if (!result.ok || !result.data) {
    throw new Error('Erro ao atualizar disponibilidade');
  }
  
  return result.data;
}

/**
 * Buscar disponibilidade por ID
 * 
 * @param availabilityId ID da disponibilidade
 * @returns Disponibilidade ou null
 */
export async function getAvailability(availabilityId: string): Promise<UnifiedAvailability | null> {
  try {
    const result = await apiFetchJson<{ ok: boolean; data: UnifiedAvailability }>(
      `/availability/${availabilityId}`
    );
    
    if (!result.ok || !result.data) {
      return null;
    }
    
    return result.data;
  } catch (error) {
    console.error('Erro ao buscar disponibilidade:', error);
    return null;
  }
}

/**
 * Listar bookings com filtros
 * 
 * @param filters Filtros de busca
 * @returns Lista de bookings
 */
export async function listBookings(filters?: {
  availabilityId?: string;
  requesterActorId?: string;
  status?: UnifiedBookingStatus;
}): Promise<UnifiedBooking[]> {
  const queryParams = new URLSearchParams();
  if (filters?.availabilityId) queryParams.append('availabilityId', filters.availabilityId);
  if (filters?.requesterActorId) queryParams.append('requesterActorId', filters.requesterActorId);
  if (filters?.status) queryParams.append('status', filters.status);
  
  const result = await apiFetchJson<{ ok: boolean; data: UnifiedBooking[] }>(
    `/availability/bookings?${queryParams.toString()}`
  );
  
  if (!result.ok || !result.data) {
    return [];
  }
  
  return result.data;
}

/**
 * Listar participantes de uma disponibilidade
 * 
 * @param availabilityId ID da disponibilidade
 * @returns Lista de participantes
 */
export async function listParticipants(availabilityId: string): Promise<AvailabilityParticipant[]> {
  try {
    const result = await apiFetchJson<{ ok: boolean; data: AvailabilityParticipant[] }>(
      `/availability/${availabilityId}/participants`
    );
    
    if (!result.ok || !result.data) {
      return [];
    }
    
    return result.data;
  } catch (error) {
    console.error('Erro ao buscar participantes:', error);
    return [];
  }
}

/**
 * Detectar conflitos de disponibilidade para um participante
 * 
 * @param availabilityId ID da disponibilidade
 * @param actorId ID do actor participante
 * @returns Lista de conflitos (alertas, não bloqueios)
 */
export async function detectConflicts(
  availabilityId: string,
  actorId: string
): Promise<AvailabilityConflict[]> {
  try {
    const result = await apiFetchJson<{ 
      ok: boolean; 
      data: {
        hasConflicts: boolean;
        conflicts: AvailabilityConflict[];
        message: string;
      };
    }>(
      `/availability/${availabilityId}/participants/${actorId}/conflicts`
    );
    
    if (!result.ok || !result.data) {
      return [];
    }
    
    // 🔧 FIX: Backend retorna { hasConflicts, conflicts, message }, não array direto
    return result.data.conflicts || [];
  } catch (error) {
    console.error('Erro ao detectar conflitos:', error);
    return [];
  }
}

