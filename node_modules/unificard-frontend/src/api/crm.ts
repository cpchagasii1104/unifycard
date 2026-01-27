// frontend/src/api/crm.ts
// SPRINT 88: CRM Canônico

import { apiFetch, apiFetchJson } from './client';

export interface CrmNote {
  id: string;
  contactId: string;
  authorActorId: string;
  authorUserId?: string;
  note: string;
  visibility: 'INTERNAL' | 'SHARED';
  metadata: Record<string, any>;
  createdAt: string;
}

export interface CrmTag {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
}

export interface CrmConsent {
  id: string;
  contactId: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH';
  status: 'GRANTED' | 'REVOKED';
  updatedByActorId: string;
  updatedByUserId?: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CrmTimelineEvent {
  type: string;
  occurredAt: string;
  title: string;
  description: string;
  metadata: Record<string, any>;
}

export interface CreateCrmNoteInput {
  note: string;
  visibility?: 'INTERNAL' | 'SHARED';
  metadata?: Record<string, any>;
}

export interface CreateCrmTagInput {
  name: string;
  color?: string;
}

export interface SetCrmConsentInput {
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH';
  status: 'GRANTED' | 'REVOKED';
  metadata?: Record<string, any>;
}

// Timeline
export async function getContactTimeline(
  contactId: string,
  filters?: {
    eventTypes?: string[];
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }
): Promise<CrmTimelineEvent[]> {
  const params = new URLSearchParams();
  if (filters?.eventTypes) {
    filters.eventTypes.forEach(t => params.append('eventTypes', t));
  }
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.offset) params.append('offset', filters.offset.toString());

  const data = await apiFetchJson(`/crm/contacts/${contactId}/timeline?${params.toString()}`) as { timeline: CrmTimelineEvent[] };
  return data.timeline;
}

// Notes
export async function addContactNote(
  contactId: string,
  input: CreateCrmNoteInput
): Promise<CrmNote> {
  return await apiFetchJson(`/crm/contacts/${contactId}/notes`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listContactNotes(contactId: string): Promise<CrmNote[]> {
  const data = await apiFetchJson(`/crm/contacts/${contactId}/notes`) as { notes: CrmNote[] };
  return data.notes;
}

// Tags
export async function createTag(input: CreateCrmTagInput): Promise<CrmTag> {
  return await apiFetchJson('/crm/tags', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listTags(): Promise<CrmTag[]> {
  const data = await apiFetchJson('/crm/tags') as { tags: CrmTag[] };
  return data.tags;
}

export async function assignTag(contactId: string, tagId: string): Promise<void> {
  await apiFetch(`/crm/contacts/${contactId}/tags/${tagId}`, {
    method: 'POST',
  });
}

export async function removeTag(contactId: string, tagId: string): Promise<void> {
  await apiFetch(`/crm/contacts/${contactId}/tags/${tagId}`, {
    method: 'DELETE',
  });
}

// Consents
export async function setConsent(
  contactId: string,
  input: SetCrmConsentInput
): Promise<CrmConsent> {
  return await apiFetchJson(`/crm/contacts/${contactId}/consents`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getConsents(contactId: string): Promise<CrmConsent[]> {
  const data = await apiFetchJson(`/crm/contacts/${contactId}/consents`) as { consents: CrmConsent[] };
  return data.consents;
}

