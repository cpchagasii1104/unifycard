// frontend/src/api/event-rsvp.ts
// API client para RSVP (confirmação de presença) em eventos

import { apiFetch, apiFetchJson } from './client';
import type { RSVPStatus } from '../types/event-rsvp';

export interface EventRSVP {
  id: string;
  event_id: string;
  tenant_id: string;
  user_id: string | null;
  guest_email: string | null;
  guest_name: string | null;
  status: RSVPStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RSVPCounts {
  yes: number;
  no: number;
  maybe: number;
}

export interface CreateRSVPInput {
  status: RSVPStatus;
  notes?: string | null;
  guest_email?: string | null;
  guest_name?: string | null;
}

/**
 * Cria ou atualiza RSVP
 */
export async function upsertRSVP(
  eventId: string,
  input: CreateRSVPInput
): Promise<EventRSVP> {
  const data = await apiFetchJson<{ rsvp: EventRSVP }>(
    `/api/events/${eventId}/rsvp`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
  return data.rsvp;
}

/**
 * Busca status de RSVP do usuário para o evento
 */
export async function getRSVPStatus(
  eventId: string,
  guestEmail?: string
): Promise<EventRSVP | null> {
  try {
    const query = guestEmail ? `?guest_email=${encodeURIComponent(guestEmail)}` : '';
    const data = await apiFetchJson<{ rsvp: EventRSVP }>(
      `/api/events/${eventId}/rsvp/status${query}`,
      {
        method: 'GET',
      },
      { silent404: true }
    );
    return data.rsvp;
  } catch (error: any) {
    if (error.status === 404 || error.code === 'FEATURE_UNAVAILABLE') {
      return null;
    }
    throw error;
  }
}

/**
 * Busca contagens de RSVP para o evento
 */
export async function getRSVPCounts(eventId: string): Promise<RSVPCounts> {
  const data = await apiFetchJson<{ counts: RSVPCounts }>(
    `/api/events/${eventId}/rsvp/counts`,
    {
      method: 'GET',
    }
  );
  return data.counts;
}

/**
 * Remove RSVP
 */
export async function removeRSVP(
  eventId: string,
  guestEmail?: string
): Promise<void> {
  const query = guestEmail ? `?guest_email=${encodeURIComponent(guestEmail)}` : '';
  await apiFetchJson<{ success: boolean }>(
    `/api/events/${eventId}/rsvp${query}`,
    {
      method: 'DELETE',
    }
  );
}



