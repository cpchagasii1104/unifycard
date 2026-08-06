// frontend/src/api/liveChat.ts
// SPRINT 95: LOCAL CHAT (OPT-IN) + PRESENÇA AO VIVO + ANTI-ABUSO

import { apiFetch, apiFetchJson } from './client';

export interface LivePresence {
  id: string;
  tenantId: string;
  contextType: 'EVENT' | 'VENUE';
  contextId: string;
  contactId: string;
  status: 'online' | 'offline';
  optedIn: boolean;
  lastSeenAt: string;
  expiresAt: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ChatRoom {
  id: string;
  tenantId: string;
  contextType: 'EVENT' | 'VENUE';
  contextId: string;
  roomType: 'PUBLIC';
  status: 'ACTIVE' | 'ARCHIVED';
  metadata: Record<string, any>;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  tenantId: string;
  roomId: string;
  contactId: string;
  content: string;
  status: 'VISIBLE' | 'DELETED';
  clientMessageId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export async function optInPresence(input: {
  contextType: 'EVENT' | 'VENUE';
  contextId: string;
  contactId: string;
}): Promise<LivePresence> {
  return await apiFetchJson('/live/presence/opt-in', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function optOutPresence(input: {
  contextType: 'EVENT' | 'VENUE';
  contextId: string;
  contactId: string;
}): Promise<LivePresence> {
  return await apiFetchJson('/live/presence/opt-out', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function heartbeatPresence(input: {
  contextType: 'EVENT' | 'VENUE';
  contextId: string;
  contactId: string;
}): Promise<LivePresence> {
  return await apiFetchJson('/live/presence/heartbeat', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listOnline(
  contextType: 'EVENT' | 'VENUE',
  contextId: string,
  limit?: number
): Promise<LivePresence[]> {
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());

  const response = await apiFetch(`/live/presence/${contextType}/${contextId}/online?${params.toString()}`);
  const data = await response.json();
  return data.online || [];
}

export async function getChatRoom(
  contextType: 'EVENT' | 'VENUE',
  contextId: string
): Promise<ChatRoom> {
  const response = await apiFetch(`/live-chat/${contextType}/${contextId}/room`);
  return await response.json();
}

export async function listMessages(
  roomId: string,
  viewerContactId: string,
  cursor?: string,
  limit?: number
): Promise<ChatMessage[]> {
  const params = new URLSearchParams();
  params.append('viewerContactId', viewerContactId);
  if (cursor) params.append('cursor', cursor);
  if (limit) params.append('limit', limit.toString());

  const response = await apiFetch(`/live-chat/rooms/${roomId}/messages?${params.toString()}`);
  const data = await response.json();
  return data.messages || [];
}

export async function sendMessage(input: {
  roomId: string;
  contactId: string;
  content: string;
  clientMessageId?: string;
}): Promise<ChatMessage> {
  return await apiFetchJson(`/live-chat/rooms/${input.roomId}/messages`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteMessage(messageId: string, contactId: string): Promise<void> {
  await apiFetchJson(`/live-chat/messages/${messageId}/delete`, {
    method: 'POST',
    body: JSON.stringify({ contactId }),
  });
}

export async function blockContact(input: {
  blockerContactId: string;
  blockedContactId: string;
  contextType: 'EVENT' | 'VENUE';
  contextId: string;
}): Promise<any> {
  return await apiFetchJson('/live-chat/block', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function reportContact(input: {
  reporterContactId: string;
  reportedContactId: string;
  roomId: string;
  messageId?: string;
  reasonCode: 'SPAM' | 'HARASSMENT' | 'HATE' | 'SEXUAL' | 'OTHER';
  details?: string;
}): Promise<any> {
  return await apiFetchJson('/live-chat/report', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}





