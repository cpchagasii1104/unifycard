// backend/src/core/pilot/pilot-events.service.ts
// SPRINT 13: Service para eventos de observação do modo piloto
// REGRA DE OURO: Nenhuma decisão de produto será tomada com base em métricas automáticas do piloto.
//
// ═══════════════════════════════════════════════════════════════
// ESCOPO DE DECISÃO (SPRINT 32)
// ═══════════════════════════════════════════════════════════════
// Decisões relacionadas a este contexto (observação)
// devem declarar seu escopo em:
// INSTITUTIONAL_DECISION_SCOPE.md
// ═══════════════════════════════════════════════════════════════

import { pilotEventsRepository, type PilotEvent, type CreatePilotEventInput } from './pilot-events.repository';

/**
 * Verifica se modo piloto está ativo
 * Ativado apenas por variável de ambiente
 */
export function isPilotMode(): boolean {
  return process.env.PILOT_MODE === 'true';
}

class PilotEventsService {
  /**
   * Registra um evento de observação
   * Apenas funciona se PILOT_MODE=true
   * Não armazena dados pessoais sensíveis
   */
  async recordEvent(
    tenantId: string,
    input: CreatePilotEventInput
  ): Promise<PilotEvent | null> {
    /**
     * EXCEÇÃO INSTITUCIONAL (SPRINT 30)
     * Motivo: Funcionalidade de observação apenas disponível em modo piloto (exceção ao modelo padrão)
     * Contexto: Sistema em fase de piloto controlado
     * Tipo: estrutural
     */
    // Não fazer nada se modo piloto não estiver ativo
    if (!isPilotMode()) {
      return null;
    }

    try {
      return await pilotEventsRepository.create(tenantId, input);
    } catch (error) {
      // Não quebrar o fluxo se observação falhar
      console.warn('[PilotEvents] Erro ao registrar evento:', error);
      return null;
    }
  }

  /**
   * Lista eventos de observação
   * Apenas funciona se PILOT_MODE=true
   */
  async listEvents(
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
      eventType?: CreatePilotEventInput['eventType'];
    }
  ): Promise<PilotEvent[]> {
    // Não retornar nada se modo piloto não estiver ativo
    if (!isPilotMode()) {
      return [];
    }

    try {
      return await pilotEventsRepository.list(tenantId, options);
    } catch (error) {
      console.warn('[PilotEvents] Erro ao listar eventos:', error);
      return [];
    }
  }

  /**
   * Conta eventos de observação
   */
  async countEvents(
    tenantId: string,
    eventType?: CreatePilotEventInput['eventType']
  ): Promise<number> {
    if (!isPilotMode()) {
      return 0;
    }

    try {
      return await pilotEventsRepository.count(tenantId, eventType);
    } catch (error) {
      console.warn('[PilotEvents] Erro ao contar eventos:', error);
      return 0;
    }
  }
}

export const pilotEventsService = new PilotEventsService();

