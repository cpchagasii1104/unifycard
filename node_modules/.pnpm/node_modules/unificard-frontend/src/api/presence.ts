// frontend/src/api/presence.ts
// SPRINT 94: PRESENÇA + CHECK-IN SOCIAL + BENEFÍCIOS PROMOCIONAIS

import { apiFetch, apiFetchJson } from './client';

export interface PresenceRsvp {
  id: string;
  tenantId: string;
  contextType: 'EVENT' | 'VENUE';
  contextId: string;
  contactId: string;
  status: 'CONFIRMED' | 'CANCELLED' | 'ATTENDED' | 'NO_SHOW';
  visibility: 'PRIVATE' | 'PUBLIC';
  confirmedAt: string | null;
  cancelledAt: string | null;
  attendedAt: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CheckinToken {
  id: string;
  tenantId: string;
  contextType: 'EVENT' | 'VENUE';
  contextId: string;
  token: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  validFrom: string | null;
  validTo: string | null;
  createdByActorId: string | null;
  createdByUserId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface Checkin {
  id: string;
  tenantId: string;
  contextType: 'EVENT' | 'VENUE';
  contextId: string;
  contactId: string;
  tokenId: string | null;
  checkinType: 'QR' | 'MANUAL';
  status: 'CHECKED_IN' | 'CHECKED_OUT';
  referenceEventId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface AttendanceStats {
  confirmed: number;
  attended: number;
  noShow: number;
  noShowRate: number;
  cancelled: number;
}

export async function confirmPresence(input: {
  contextType: 'EVENT' | 'VENUE';
  contextId: string;
  contactId: string;
  visibility?: 'PRIVATE' | 'PUBLIC';
}): Promise<PresenceRsvp> {
  return await apiFetchJson('/presence/rsvp/confirm', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function cancelPresence(input: {
  contextType: 'EVENT' | 'VENUE';
  contextId: string;
  contactId: string;
}): Promise<PresenceRsvp> {
  return await apiFetchJson('/presence/rsvp/cancel', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function setVisibility(rsvpId: string, visibility: 'PRIVATE' | 'PUBLIC'): Promise<PresenceRsvp> {
  return await apiFetchJson(`/presence/rsvp/${rsvpId}/visibility`, {
    method: 'POST',
    body: JSON.stringify({ visibility }),
  });
}

export async function listMyPresence(contactId: string, filters?: {
  status?: 'CONFIRMED' | 'CANCELLED' | 'ATTENDED' | 'NO_SHOW';
  limit?: number;
  offset?: number;
}): Promise<PresenceRsvp[]> {
  const params = new URLSearchParams();
  params.append('contactId', contactId);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.offset) params.append('offset', filters.offset.toString());

  const response = await apiFetch(`/presence/my?${params.toString()}`);
  const data = await response.json();
  return data.rsvps || [];
}

export async function listPublicPresence(
  contextType: 'EVENT' | 'VENUE',
  contextId: string,
  filters?: {
    status?: 'CONFIRMED' | 'CANCELLED' | 'ATTENDED' | 'NO_SHOW';
    limit?: number;
    offset?: number;
  }
): Promise<PresenceRsvp[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.offset) params.append('offset', filters.offset.toString());

  const response = await apiFetch(`/presence/${contextType}/${contextId}/public?${params.toString()}`);
  const data = await response.json();
  return data.rsvps || [];
}

export async function checkInByToken(input: {
  token: string;
  contactId: string;
  referenceEventId?: string;
}): Promise<{ checkin: Checkin; benefitsApplied: number }> {
  return await apiFetchJson('/presence/checkin/by-token', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getAttendanceStats(
  contextType: 'EVENT' | 'VENUE',
  contextId: string
): Promise<AttendanceStats> {
  const response = await apiFetch(`/presence/${contextType}/${contextId}/stats`);
  return await response.json();
}

export async function createCheckinToken(input: {
  contextType: 'EVENT' | 'VENUE';
  contextId: string;
  validFrom?: string;
  validTo?: string;
  metadata?: Record<string, any>;
}): Promise<CheckinToken> {
  return await apiFetchJson(`/presence/${input.contextType}/${input.contextId}/tokens`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}





