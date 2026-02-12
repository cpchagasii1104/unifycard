// frontend/src/api/contextual-messaging.ts
// API Client para Mensageria Contextual

import { apiFetch } from './client';

export type ContextualThreadType = 'event' | 'rfq' | 'booking' | 'service_order';

export interface ContextualThread {
  threadId: string;
  tenantId: string;
  contextType: ContextualThreadType;
  contextId: string;
  title?: string | null;
  participantActorIds: string[];
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContextualMessage {
  messageId: string;
  threadId: string;
  tenantId: string;
  senderActorId: string;
  senderUserId?: string | null;
  content: string;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface CreateContextualThreadInput {
  contextType: ContextualThreadType;
  contextId: string;
  title?: string | null;
  participantActorIds: string[];
  metadata?: Record<string, any>;
}

export interface SendContextualMessageInput {
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Criar thread contextual
 */
export async function createContextualThread(
  input: CreateContextualThreadInput
): Promise<ContextualThread> {
  const response = await apiFetch('/contextual-threads', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao criar thread' }));
    throw new Error(error.error || 'Erro ao criar thread');
  }

  return response.json();
}

/**
 * Buscar thread por ID
 */
export async function getContextualThread(threadId: string): Promise<ContextualThread> {
  const response = await apiFetch(`/contextual-threads/${threadId}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao buscar thread' }));
    throw new Error(error.error || 'Erro ao buscar thread');
  }

  return response.json();
}

/**
 * Buscar thread por contexto
 */
export async function getContextualThreadByContext(
  contextType: ContextualThreadType,
  contextId: string
): Promise<ContextualThread | null> {
  const response = await apiFetch(`/contextual-threads/context/${contextType}/${contextId}`);

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const error = await response.json().catch(() => ({ error: 'Erro ao buscar thread' }));
    throw new Error(error.error || 'Erro ao buscar thread');
  }

  return response.json();
}

/**
 * Listar threads com filtros
 */
export async function listContextualThreads(filters?: {
  contextType?: ContextualThreadType;
  contextId?: string;
  participantActorId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ threads: ContextualThread[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.contextType) params.append('contextType', filters.contextType);
  if (filters?.contextId) params.append('contextId', filters.contextId);
  if (filters?.participantActorId) params.append('participantActorId', filters.participantActorId);
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.offset) params.append('offset', filters.offset.toString());

  const response = await apiFetch(`/contextual-threads?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao listar threads' }));
    throw new Error(error.error || 'Erro ao listar threads');
  }

  return response.json();
}

/**
 * Adicionar participante à thread
 */
export async function addThreadParticipant(
  threadId: string,
  actorId: string
): Promise<ContextualThread> {
  const response = await apiFetch(`/contextual-threads/${threadId}/participants`, {
    method: 'POST',
    body: JSON.stringify({ actorId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao adicionar participante' }));
    throw new Error(error.error || 'Erro ao adicionar participante');
  }

  return response.json();
}

/**
 * Enviar mensagem em thread
 */
export async function sendContextualMessage(
  threadId: string,
  input: SendContextualMessageInput
): Promise<ContextualMessage> {
  const response = await apiFetch(`/contextual-threads/${threadId}/messages`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao enviar mensagem' }));
    throw new Error(error.error || 'Erro ao enviar mensagem');
  }

  return response.json();
}

/**
 * Listar mensagens de uma thread
 */
export async function getContextualMessages(
  threadId: string,
  limit?: number,
  offset?: number
): Promise<{ messages: ContextualMessage[]; total: number }> {
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (offset) params.append('offset', offset.toString());

  const response = await apiFetch(`/contextual-threads/${threadId}/messages?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao listar mensagens' }));
    throw new Error(error.error || 'Erro ao listar mensagens');
  }

  return response.json();
}




