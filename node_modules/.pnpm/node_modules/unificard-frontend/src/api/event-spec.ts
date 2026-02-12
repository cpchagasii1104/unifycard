// frontend/src/api/event-spec.ts
// API client para EventSpec - Especificação Declarativa de Evento
// FASE 5: Escrita incremental e fechamento

import { apiFetchJson } from './client';
import type { CreateEventSpecInput, EventSpec } from '../types/event-spec';

/**
 * Cria um novo EventSpec
 */
export async function createEventSpec(
  input: CreateEventSpecInput
): Promise<EventSpec> {
  const data = await apiFetchJson<{ spec: EventSpec }>(
    '/api/events/event-specs',
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
  return data.spec;
}

/**
 * Busca EventSpec por ID
 */
export async function getEventSpecById(specId: string): Promise<EventSpec> {
  const data = await apiFetchJson<{ spec: EventSpec }>(
    `/api/events/event-specs/${specId}`,
    {
      method: 'GET',
    }
  );
  return data.spec;
}

/**
 * Atualiza incrementalmente o EventSpec durante FASE 5 (INTENT_DRAFT)
 * 
 * 🔴 REGRA CANÔNICA:
 * - Permitido apenas quando EventSpec está em construção (não fechado)
 * - Event associado deve estar em status 'draft'
 * - Merge superficial de partialSpec com answers existente
 */
export async function updateEventSpecIncremental(
  specId: string,
  partialSpec: Record<string, any>
): Promise<EventSpec> {
  const data = await apiFetchJson<{ spec: EventSpec }>(
    `/api/events/event-specs/${specId}/incremental`,
    {
      method: 'PATCH',
      body: JSON.stringify({ partialSpec }),
    }
  );
  return data.spec;
}

/**
 * Fecha o EventSpec (torna imutável)
 * 
 * 🔴 REGRA CANÔNICA:
 * - Executado mediante ação humana explícita "Salvar planejamento"
 * - Após fechamento, EventSpec torna-se imutável
 * - Qualquer alteração futura exige novo snapshot
 */
export async function closeEventSpec(specId: string): Promise<EventSpec> {
  const data = await apiFetchJson<{ spec: EventSpec }>(
    `/api/events/event-specs/${specId}/close`,
    {
      method: 'POST',
    }
  );
  return data.spec;
}

/**
 * Busca EventSpec ativo (não fechado) para um evento
 * Retorna o EventSpec mais recente que não está fechado
 */
export async function getActiveEventSpecForEvent(eventId: string): Promise<EventSpec | null> {
  try {
    const data = await apiFetchJson<{ specs: EventSpec[] }>(
      `/api/events/event-specs?event_id=${encodeURIComponent(eventId)}&limit=10`,
      {
        method: 'GET',
      }
    );
    
    // Filtrar apenas EventSpecs não fechados
    const activeSpecs = (data.specs || []).filter(
      spec => !spec.metadata?.closed
    );
    
    // Retornar o mais recente (primeiro da lista ordenada por created_at DESC)
    return activeSpecs.length > 0 ? activeSpecs[0] : null;
  } catch (err: any) {
    // Se não encontrar, retornar null (não é erro)
    if (err.status === 404 || err.status === 400) {
      return null;
    }
    throw err;
  }
}

