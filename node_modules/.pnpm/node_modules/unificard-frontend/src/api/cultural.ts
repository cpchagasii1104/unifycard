// src/api/cultural.ts
// API para Cultura & Eventos - FASE 16
// Perfis de Atuação Cultural (PAC) e Eventos Culturais

import { apiFetchJson } from './client';

export type CulturalProfileType =
  | 'ARTIST'
  | 'BAND'
  | 'BAR'
  | 'VENUE'
  | 'COLLECTIVE'
  | 'PRODUCER'
  | 'CIRCLE'
  | 'EDUCATOR'
  | 'CURATOR';

export type EventType =
  | 'SHOW'
  | 'OFICINA'
  | 'FESTIVAL'
  | 'RODA'
  | 'AULA'
  | 'EXPOSICAO'
  | 'DEBATE'
  | 'INTERVENCAO';

export type EventStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ARCHIVED';

export interface CulturalProfile {
  id: string;
  tenant_id: string;
  owner_actor_id: string;
  owner_actor_type: 'user' | 'page';
  type: CulturalProfileType;
  display_name: string;
  slug: string;
  description: string | null;
  linked_company_id: string | null;
  location: {
    city?: string;
    state?: string;
    address?: string;
    lat?: number;
    lng?: number;
  } | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RevenueSplit {
  target_type: 'CULTURAL_PROFILE' | 'REGION' | 'FUND';
  target_id: string;
  percentage: number;
}

export interface CulturalEvent {
  id: string;
  tenant_id: string;
  created_by_cultural_profile_id: string;
  co_creators_cultural_profile_ids: string[];
  event_type: EventType;
  title: string;
  description: string | null;
  datetime_start: string;
  datetime_end: string;
  location_cultural_profile_id: string | null;
  status: EventStatus;
  visibility: 'PUBLIC' | 'LOCAL' | 'PRIVATE';
  ticket_price_cents: number | null;
  max_attendees: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  revenue_split?: RevenueSplit[];
}

export interface CreateCulturalProfileInput {
  owner_actor_id: string;
  owner_actor_type: 'user' | 'page';
  type: CulturalProfileType;
  display_name: string;
  slug: string;
  description?: string;
  linked_company_id?: string;
  location?: {
    city?: string;
    state?: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
}

export interface CreateCulturalEventInput {
  created_by_cultural_profile_id: string;
  co_creators_cultural_profile_ids?: string[];
  event_type: EventType;
  title: string;
  description?: string;
  datetime_start: string;
  datetime_end: string;
  location_cultural_profile_id?: string;
  visibility?: 'PUBLIC' | 'LOCAL' | 'PRIVATE';
  ticket_price_cents?: number;
  max_attendees?: number;
  revenue_split: RevenueSplit[];
}

/**
 * Cria um novo Perfil de Atuação Cultural (PAC)
 */
export async function createCulturalProfile(
  input: CreateCulturalProfileInput
): Promise<CulturalProfile> {
  return apiFetchJson<CulturalProfile>('/cultural/profiles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Lista PACs de um ator
 */
export async function listCulturalProfiles(
  ownerActorId: string,
  ownerActorType: 'user' | 'page'
): Promise<{ profiles: CulturalProfile[] }> {
  return apiFetchJson<{ profiles: CulturalProfile[] }>(
    `/cultural/profiles?owner_actor_id=${ownerActorId}&owner_actor_type=${ownerActorType}`
  );
}

/**
 * Busca PAC por ID
 */
export async function getCulturalProfile(profileId: string): Promise<CulturalProfile> {
  return apiFetchJson<CulturalProfile>(`/cultural/profiles/${profileId}`);
}

/**
 * Cria evento cultural (DRAFT)
 */
export async function createCulturalEvent(
  input: CreateCulturalEventInput
): Promise<CulturalEvent> {
  return apiFetchJson<CulturalEvent>('/cultural/events', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Publica evento (DRAFT → PUBLISHED)
 */
export async function publishCulturalEvent(eventId: string): Promise<CulturalEvent> {
  return apiFetchJson<CulturalEvent>(`/cultural/events/${eventId}/publish`, {
    method: 'POST',
  });
}

/**
 * Local confirma evento (PUBLISHED → CONFIRMED)
 */
export async function confirmEventLocation(
  eventId: string,
  locationCulturalProfileId: string
): Promise<CulturalEvent> {
  return apiFetchJson<CulturalEvent>(`/cultural/events/${eventId}/confirm-location`, {
    method: 'POST',
    body: JSON.stringify({ location_cultural_profile_id: locationCulturalProfileId }),
  });
}

/**
 * Completa evento (CONFIRMED → COMPLETED)
 */
export async function completeCulturalEvent(eventId: string): Promise<CulturalEvent> {
  return apiFetchJson<CulturalEvent>(`/cultural/events/${eventId}/complete`, {
    method: 'POST',
  });
}

/**
 * Busca evento por ID
 */
export async function getCulturalEvent(eventId: string): Promise<CulturalEvent> {
  return apiFetchJson<CulturalEvent>(`/cultural/events/${eventId}`);
}

/**
 * Lista eventos públicos
 */
export async function listPublicCulturalEvents(params?: {
  limit?: number;
  cursor?: string;
}): Promise<{ events: CulturalEvent[]; next_cursor: string | null }> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.cursor) queryParams.set('cursor', params.cursor);

  const query = queryParams.toString();
  return apiFetchJson<{ events: CulturalEvent[]; next_cursor: string | null }>(
    `/cultural/events${query ? `?${query}` : ''}`
  );
}

/**
 * FASE 17: Check-in em Eventos Culturais
 */

export interface CheckInQRResponse {
  qr_code: string;
  expires_at: string;
  event: CulturalEvent;
}

export interface CheckInResponse {
  success: boolean;
  check_in: {
    id: string;
    event_id: string;
    actor_id: string;
    actor_type: string;
    check_in_time: string;
    method: string;
  };
  impact_generated: number;
}

export interface CheckInStatus {
  has_checked_in: boolean;
  check_in_time: string | null;
  method: string | null;
  can_check_in: boolean;
  event_status: EventStatus;
  event_datetime: {
    start: string;
    end: string;
  };
}

export interface CheckInListResponse {
  check_ins: Array<{
    id: string;
    actor_id: string;
    actor_type: string;
    actor_display_name: string;
    check_in_time: string;
    method: string;
    checked_in_by: { id: string; type: string; name: string } | null;
  }>;
  total: number;
  next_cursor: string | null;
}

/**
 * Gera QR code de check-in para evento
 */
export async function generateCheckInQR(eventId: string): Promise<CheckInQRResponse> {
  return apiFetchJson<CheckInQRResponse>(`/cultural/events/${eventId}/check-in/qr`);
}

/**
 * Realiza check-in em evento cultural
 */
export async function checkInToEvent(
  eventId: string,
  params: {
    method: 'QR_CODE' | 'MANUAL' | 'AUTO';
    qr_code?: string;
    target_actor_id?: string;
    target_actor_type?: 'user' | 'page' | 'cultural_profile';
    geo?: { lat: number; lng: number };
    device_fingerprint?: string;
    metadata?: Record<string, any>;
  }
): Promise<CheckInResponse> {
  return apiFetchJson<CheckInResponse>(`/cultural/events/${eventId}/check-in`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * EVENTOS ÂNCORA: Conta check-ins de um evento (leve, para eventos grandes)
 */
export async function getCheckInCount(eventId: string): Promise<number> {
  const data = await apiFetchJson<{ count: number }>(`/cultural/events/${eventId}/checkins/count`);
  return data.count;
}

/**
 * Lista check-ins de um evento
 */
export async function listEventCheckIns(
  eventId: string,
  params?: { limit?: number; cursor?: string }
): Promise<CheckInListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.cursor) queryParams.set('cursor', params.cursor);

  const query = queryParams.toString();
  return apiFetchJson<CheckInListResponse>(
    `/cultural/events/${eventId}/check-ins${query ? `?${query}` : ''}`
  );
}

/**
 * Verifica status de check-in do usuário atual
 */
export async function getCheckInStatus(eventId: string): Promise<CheckInStatus> {
  return apiFetchJson<CheckInStatus>(`/cultural/events/${eventId}/check-in/status`);
}

