// src/api/availability.ts
// Client API para Unified Availability
// Integra frontend com backend Unified Availability Core

import { apiFetchJson } from './client';

/**
 * Backend tem 2 shapes de response convivendo:
 *   - `{ ok: true, data: T }` (rotas de availability)
 *   - `T` direto, sem wrapper (rotas de booking lifecycle: bookings POST/PUT/check-in/check-out)
 *
 * Esta função normaliza ambos. Convergência completa exigiria refactor de
 * rotas backend (fora do escopo de B+A; registrar como DT se virar gargalo).
 */
function unwrapResponse<T>(raw: any): T {
  if (raw && typeof raw === 'object' && 'ok' in raw && 'data' in raw) {
    return raw.data as T;
  }
  return raw as T;
}

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
 * Convenção de chaves reservadas em availability.metadata (v2 invariante 3 — buffers físicos)
 *
 * B+A2: campos estruturalmente reservados, SEM UI ativa nesta fase.
 * Backend ainda não interpreta — apenas armazena. Fase 6 (matching) e Fase 7
 * (recomposição) ativarão interpretação. Reservar agora evita backfill quando
 * dados já existem.
 *
 * Princípio: "disponibilidade matemática ≠ disponibilidade física".
 * Matching/recomposição futuros honram ambos os buffers.
 */
export interface AvailabilityBufferMetadata {
  /** Minutos de preparação/setup antes do start_datetime (v2 invariante 3) */
  buffer_before_minutes?: number;
  /** Minutos de limpeza/deslocamento/transição depois do end_datetime (v2 invariante 3) */
  buffer_after_minutes?: number;
}

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
  /**
   * Metadata JSONB extensível. Chaves reservadas convencionais
   * documentadas em AvailabilityBufferMetadata (sem UI ativa em Fase 2).
   */
  metadata: Record<string, any> & Partial<AvailabilityBufferMetadata>;
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
 * F2 (DECISION-0072 B1): grade semanal declarativa e resultado da materialização.
 * `schedule` é INPUT (dia-da-semana → faixas "HH:MM-HH:MM" + opcional `specific`). NÃO é persistido
 * como blob — o backend materializa em janelas concretas no SSOT `availability`.
 */
export type WeeklyAvailabilitySchedule = Record<string, string[]>;

export interface MaterializeWeeklyTemplateResult {
  created: number;
  kept: number;
  reactivated: number;
  retired: number;
  protectedCount: number;
  rejected: Array<{ entry: string; reason: string }>;
  conflicts: Array<{ templateKey: string; reason: string }>;
  horizonWeeks: number;
  timezone: string;
  ownerType: string;
  ownerId: string;
}

/**
 * Materializa a grade semanal declarativa em janelas concretas no SSOT temporal `availability`
 * (PUT /availability/weekly-template — DECISION-0072 B1). `ownerId` NÃO é enviado: o backend usa o
 * actor do contexto (actionContext). `timezone` IANA é obrigatória (sem fallback silencioso).
 */
export async function putWeeklyAvailabilityTemplate(input: {
  schedule: WeeklyAvailabilitySchedule;
  timezone: string;
  horizonWeeks?: number;
}): Promise<MaterializeWeeklyTemplateResult> {
  const result = await apiFetchJson<{ ok: boolean; data: MaterializeWeeklyTemplateResult }>(
    '/availability/weekly-template',
    {
      method: 'PUT',
      body: JSON.stringify(input),
    }
  );

  if (!result.ok || !result.data) {
    throw new Error('Erro ao salvar disponibilidade semanal');
  }

  return result.data;
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
 * Criar booking (status inicial: 'requested')
 *
 * B+A1: wrapper HTTP do caminho canônico unified-availability.
 * Lifecycle posterior via updateBooking/checkInBooking/checkOutBooking/cancelBooking.
 *
 * @param input availabilityId + requesterActorId obrigatórios; notes e metadata opcionais
 * @returns Booking criado
 */
export async function createBooking(input: {
  availabilityId: string;
  requesterActorId: string;
  notes?: string | null;
  metadata?: Record<string, any>;
}): Promise<UnifiedBooking> {
  const raw = await apiFetchJson<any>('/availability/bookings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const booking = unwrapResponse<UnifiedBooking>(raw);
  if (!booking?.bookingId) {
    throw new Error('Erro ao criar booking');
  }
  return booking;
}

/**
 * Confirmar booking (status: 'requested' → 'confirmed')
 *
 * B+A1: usa rota genérica PUT /availability/bookings/:id passando status='confirmed'.
 * Backend é fonte da verdade; frontend apenas declara transição.
 */
export async function confirmBooking(
  bookingId: string,
  metadata?: Record<string, any>
): Promise<UnifiedBooking> {
  const raw = await apiFetchJson<any>(`/availability/bookings/${bookingId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'confirmed', metadata }),
  });
  const booking = unwrapResponse<UnifiedBooking>(raw);
  if (!booking?.bookingId) {
    throw new Error('Erro ao confirmar booking');
  }
  return booking;
}

/**
 * Cancelar booking (qualquer status ativo → 'cancelled')
 *
 * B+A1: usa rota genérica PUT /availability/bookings/:id passando status='cancelled'.
 *
 * v2.1 invariante 5 (cancelamento como redistribuição causal):
 *   - reason e service_type/urgency embedded em metadata permitem
 *     que evento booking.cancelled no outbox carregue payload suficiente
 *     para recomposição futura (Fase 7) sem migration retroativa.
 *   - Frontend apenas declara intenção; backend é responsável por emitir evento.
 */
export async function cancelBooking(
  bookingId: string,
  input?: {
    reason?: 'cliente_desistiu' | 'profissional_nao_pode' | 'no_show' | 'outro';
    metadata?: Record<string, any>;
  }
): Promise<UnifiedBooking> {
  const cancelMetadata: Record<string, any> = {
    ...(input?.metadata ?? {}),
    cancel_reason: input?.reason ?? 'outro',
    cancelled_via: 'frontend_user_action',
  };

  const raw = await apiFetchJson<any>(`/availability/bookings/${bookingId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled', metadata: cancelMetadata }),
  });
  const booking = unwrapResponse<UnifiedBooking>(raw);
  if (!booking?.bookingId) {
    throw new Error('Erro ao cancelar booking');
  }
  return booking;
}

/**
 * Check-in (status confirmed → checked_in; popula checked_in_at)
 *
 * B+A1: rota dedicada POST /availability/bookings/:id/check-in.
 */
export async function checkInBooking(
  bookingId: string,
  metadata?: Record<string, any>
): Promise<UnifiedBooking> {
  const raw = await apiFetchJson<any>(`/availability/bookings/${bookingId}/check-in`, {
    method: 'POST',
    body: JSON.stringify({ metadata: metadata ?? {} }),
  });
  const booking = unwrapResponse<UnifiedBooking>(raw);
  if (!booking?.bookingId) {
    throw new Error('Erro ao realizar check-in');
  }
  return booking;
}

/**
 * Check-out (status checked_in → checked_out; popula checked_out_at)
 *
 * B+A1: rota dedicada POST /availability/bookings/:id/check-out.
 */
export async function checkOutBooking(
  bookingId: string,
  metadata?: Record<string, any>
): Promise<UnifiedBooking> {
  const raw = await apiFetchJson<any>(`/availability/bookings/${bookingId}/check-out`, {
    method: 'POST',
    body: JSON.stringify({ metadata: metadata ?? {} }),
  });
  const booking = unwrapResponse<UnifiedBooking>(raw);
  if (!booking?.bookingId) {
    throw new Error('Erro ao realizar check-out');
  }
  return booking;
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

