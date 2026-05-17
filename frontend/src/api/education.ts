// src/api/education.ts
// API para perfil educacional - MODELO 100% EVENT-BASED

import { apiFetch, extractErrorMessage } from './client';

export type EducationType = 'formal' | 'informal' | 'autodidata';

export type EducationEventType =
  | 'educacao.declarada'
  | 'educacao.iniciada'
  | 'educacao.concluida'
  | 'educacao.abandonada'
  | 'educacao.contestada'
  | 'educacao.confirmada'
  | 'educacao.validada_institucionalmente';

export interface EducationEventPayload {
  educationId?: string;
  type: EducationType;
  institution?: string;
  course?: string;
  startDate?: string;
  endDate?: string | null;
  description?: string;
  reason?: string;
  validator?: string;
  evidence?: string;
}

export interface EducationEvent {
  eventId: string;
  tenantId: string;
  actorId: string;
  eventType: EducationEventType;
  payload: EducationEventPayload;
  createdAt: Date;
  version: number;
  metadata?: Record<string, unknown>;
}

export interface EducationEntry {
  educationId: string;
  type: EducationType;
  institution?: string;
  course?: string;
  startDate?: string;
  endDate?: string | null;
  description?: string;
  currentStatus: EducationEventType;
  events?: Array<{
    eventType: EducationEventType;
    createdAt: Date;
    metadata?: Record<string, unknown>;
  }>;
}

export interface EducationProfile {
  globalUserId: string;
  education: EducationEntry[];
}

export interface CreateEducationEventInput {
  eventType: EducationEventType;
  payload: EducationEventPayload;
}

/**
 * Busca perfil educacional (READ-MODEL derivado dos eventos)
 */
export async function getEducationProfile(): Promise<EducationProfile> {
  const response = await apiFetch('/profile/education');
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(extractErrorMessage(errorData, `Erro ${response.status}: ${response.statusText}`));
  }
  
  const result = await response.json();
  if (result.ok && result.data) {
    return result.data;
  }
  return result;
}

/**
 * Lista eventos educacionais do usuário
 */
export async function listEducationEvents(): Promise<EducationEvent[]> {
  const response = await apiFetch('/education/events');
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(extractErrorMessage(errorData, `Erro ${response.status}: ${response.statusText}`));
  }
  
  const result = await response.json();
  if (result.ok && result.data) {
    return result.data;
  }
  return result;
}

/**
 * Cria um evento educacional (APPEND-ONLY)
 */
export async function createEducationEvent(input: CreateEducationEventInput): Promise<EducationEvent> {
  const response = await apiFetch('/education/events', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(extractErrorMessage(errorData, `Erro ${response.status}: ${response.statusText}`));
  }
  
  const result = await response.json();
  if (result.ok && result.data) {
    return result.data;
  }
  return result;
}

