// src/api/events-v2.ts
// API V2 - Event Creation Orchestration (FASE 5.0)
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - Apenas orquestra chamadas declarativas ao backend

import { apiFetch, apiFetchJson } from './client';

/**
 * Input para criar ou avançar rascunho
 */
export interface CreateDraftInput {
  event?: {
    actor_id?: string;
    actor_type?: 'user' | 'page';
    event_type?: string;
    title?: string;
    description?: string | null;
    datetime_start?: string;
    datetime_end?: string;
    visibility?: 'public' | 'connections' | 'only_me';
    max_attendees?: number | null;
    // A1b: contexto de grupo. O cliente só PROJETA o alvo; a AUTORIDADE (representar o group-actor) e o
    // vínculo governado vivem no backend (/v2/create → createEventBoundToGroup, F0-grupo). 403 se sem autoridade.
    group_id?: string;
    // DT-EVENT-CREATE-TIMEZONE-DEFAULTS-UTC: IANA timezone do evento. Opcional — omitido cai no DEFAULT
    // 'UTC' do banco (comportamento antigo, preservado).
    timezone?: string;
  };
  event_id?: string;
}

/**
 * Input para declarar evento
 */
export interface DeclareEventInput {
  title: string;
  description?: string | null;
  event_aspects: string[];
  visibility: 'public' | 'connections' | 'only_me';
  intent_flags?: string[];
  desired_time_windows?: Array<{
    start_datetime: string;
    end_datetime: string;
    timezone?: string;
  }>;
  flexibility_level?: 'strict' | 'flexible' | 'very_flexible';
  timezone?: string;
}

/**
 * Input para definir time windows
 */
export interface SetTimeWindowsInput {
  desired_time_windows?: Array<{
    start_datetime: string;
    end_datetime: string;
    timezone?: string;
  }>;
  flexibility_level?: 'strict' | 'flexible' | 'very_flexible';
  timezone?: string;
}

/**
 * Resumo do evento (read-only)
 */
export interface EventSummary {
  event: {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    visibility: string;
    declaration?: any;
  };
  declaration?: any;
  availability_rich?: any;
  operational_commitments?: any[];
  economic_preview?: {
    status: string;
    currency?: string;
    total_amount_cents?: number;
    notes?: string;
  };
}

/**
 * POST /events/v2/create
 * Cria ou avança um RASCUNHO
 * Nunca "evento final", nunca confirma nada
 * 
 * 🔴 GARANTIA: apiFetchJson injeta automaticamente:
 * - Authorization (Bearer token) via getAuthToken()
 * - x-tenant-id via getTenantId()
 * - x-action-context (ActionContext V2) via localStorage 'unificard_active_actor_id' + tenant
 */
export async function createOrAdvanceDraft(input: CreateDraftInput): Promise<{ event: any }> {
  // apiFetchJson usa apiFetch internamente, que injeta todos os headers necessários
  const response = await apiFetchJson<{ event: any }>('/api/events/v2/create', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

/**
 * POST /events/:id/v2/declare
 * Declara um evento, persistindo a EventDeclaration
 */
export async function declareEvent(eventId: string, declaration: DeclareEventInput): Promise<{ event: any }> {
  const response = await apiFetchJson<{ event: any }>(`/api/events/${eventId}/v2/declare`, {
    method: 'POST',
    body: JSON.stringify(declaration),
  });
  return response;
}

/**
 * POST /events/:id/v2/time-windows
 * Define as janelas de tempo desejadas para o evento
 */
export async function setTimeWindows(eventId: string, input: SetTimeWindowsInput): Promise<{ event: any }> {
  const response = await apiFetchJson<{ event: any }>(`/api/events/${eventId}/v2/time-windows`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

/**
 * GET /events/:id/v2/summary
 * Agrega o estado declarativo completo do evento para um resumo
 * Apenas leitura, sem side-effects
 */
export async function getEventSummary(eventId: string): Promise<{ summary: EventSummary }> {
  const response = await apiFetchJson<{ summary: EventSummary }>(`/api/events/${eventId}/v2/summary`, {
    method: 'GET',
  });
  return response;
}

