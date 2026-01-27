// frontend/src/services/pilot-observer.service.ts
// CONTINUOUS PRODUCTION: Serviço de Observação Silenciosa - SPRINT 13
// Registra eventos de observação sem interferir no comportamento do usuário
//
// ═══════════════════════════════════════════════════════════════
// CONCEITO CANÔNICO (SPRINT 29)
// ═══════════════════════════════════════════════════════════════
// CONCEITO: Observação Silenciosa
// NÃO DUPLICAR ESTE CONCEITO
// 
// Este arquivo é o ponto canônico para:
// - Observação silenciosa de eventos
// - Registro de ocorrências do piloto sem interferir no comportamento
// 
// Arquivos relacionados que USAM este conceito:
// - pilot-events.service.ts (backend)
// - pilot-events.repository.ts (backend)
// 
// Para qualquer necessidade de observação, use este arquivo.
// 
// ═══════════════════════════════════════════════════════════════
// EVOLUÇÃO CONCEITUAL (SPRINT 31)
// ═══════════════════════════════════════════════════════════════
// Este conceito pode evoluir ao longo do tempo.
// Mudanças de significado devem ser registradas em:
// INSTITUTIONAL_CONCEPT_EVOLUTIONS.md
// ═══════════════════════════════════════════════════════════════
//
// ═══════════════════════════════════════════════════════════════
// CLASSIFICAÇÃO DE RESPONSABILIDADE (SPRINT 28)
// ═══════════════════════════════════════════════════════════════
// CAMADA: Observação
// PÚBLICO PERMITIDO: Apenas admin em modo piloto
// 
// ❌ NÃO USAR FORA DO CONTEXTO DE OBSERVAÇÃO
// ❌ NÃO importar em componentes de ação
// ❌ NÃO importar em handlers de execução
// ❌ NÃO importar em fluxos de usuário final
// 
// ✅ USAR APENAS em:
//    - Observação silenciosa de eventos
//    - Registro de ocorrências do piloto
//    - Ferramentas de observação (não ação)
// ═══════════════════════════════════════════════════════════════

import { isPilotMode } from '../config/pilot';
import { apiFetch } from '../api/client';

/**
 * Tipos de eventos observados
 */
export type PilotEventType =
  | 'first_action_executed'
  | 'first_company_created'
  | 'first_delegation'
  | 'first_dispute_opened'
  | 'first_transaction'
  | 'first_group_allocation'
  | 'first_workflow_completed'
  | 'first_member_invited'
  // SPRINT 14: Eventos de fricção
  | 'invite_not_used'
  | 'signup_abandoned'
  | 'first_action_timeout'
  | 'workflow_started_not_completed';

/**
 * Evento de observação
 */
export interface PilotEvent {
  id: string;
  type: PilotEventType;
  actorId: string;
  actorType: string;
  timestamp: string;
  metadata?: {
    [key: string]: any;
  };
}

// Armazenamento local temporário (em produção, usar backend)
const PILOT_EVENTS_STORAGE_KEY = 'unify_pilot_events';

/**
 * Registra um evento de observação
 * Apenas se modo piloto estiver ativo
 */
export function observePilotEvent(
  type: PilotEventType,
  actorId: string,
  actorType: string,
  metadata?: Record<string, any>
): void {
  // Não fazer nada se modo piloto não estiver ativo
  if (!isPilotMode()) {
    return;
  }

  try {
    // Verificar se este evento já foi registrado para este actor
    const existingEvents = getStoredEvents();
    const alreadyRecorded = existingEvents.some(
      (e) => e.type === type && e.actorId === actorId
    );

    // Não registrar duplicatas
    if (alreadyRecorded) {
      return;
    }

    // Criar evento
    const event: PilotEvent = {
      id: `pilot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      actorId,
      actorType,
      timestamp: new Date().toISOString(),
      metadata: metadata || {},
    };

    // Armazenar localmente (fallback)
    const events = [...existingEvents, event];
    saveEvents(events);

    // Enviar para backend via API (assíncrono, não bloqueia)
    sendEventToBackend(type, actorId, actorType, metadata).catch((err) => {
      // Erro silencioso - não quebrar fluxo
      console.warn('[PilotObserver] Erro ao enviar evento ao backend:', err);
    });
  } catch (error) {
    // Não quebrar o fluxo se observação falhar
    console.warn('[PilotObserver] Erro ao registrar evento:', error);
  }
}

/**
 * Obtém todos os eventos observados
 */
export function getPilotEvents(): PilotEvent[] {
  if (!isPilotMode()) {
    return [];
  }

  return getStoredEvents();
}

/**
 * Limpa eventos observados (apenas para testes)
 */
export function clearPilotEvents(): void {
  if (!isPilotMode()) {
    return;
  }

  try {
    localStorage.removeItem(PILOT_EVENTS_STORAGE_KEY);
  } catch (error) {
    console.warn('[PilotObserver] Erro ao limpar eventos:', error);
  }
}

// Funções auxiliares privadas

/**
 * Envia evento ao backend (assíncrono)
 */
async function sendEventToBackend(
  type: PilotEventType,
  actorId: string,
  actorType: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await apiFetch('/admin/pilot/events', {
      method: 'POST',
      body: JSON.stringify({
        eventType: type,
        actorId,
        actorType,
        metadata: metadata || {},
      }),
    }, { silent401: true });
  } catch (error) {
    // Erro silencioso - não quebrar fluxo
    throw error;
  }
}

function getStoredEvents(): PilotEvent[] {
  try {
    const stored = localStorage.getItem(PILOT_EVENTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveEvents(events: PilotEvent[]): void {
  try {
    localStorage.setItem(PILOT_EVENTS_STORAGE_KEY, JSON.stringify(events));
  } catch (error) {
    console.warn('[PilotObserver] Erro ao salvar eventos:', error);
  }
}


