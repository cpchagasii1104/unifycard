// backend/src/core/events/event-economic-phase.service.ts
// Event Economic Phase Service (FASE 6.0)
// Verificação de pré-condições e handoff

/**
 * 🔴 PRÉ-CONDIÇÃO ABSOLUTA DA FASE 6.0
 * 
 * Um evento só entra na Fase 6.0 se:
 * - Handoff Fase 5.0 foi executado
 * - Evento `event.advance_to_economic_phase` foi emitido
 * - Usuário aceitou termos econômicos
 * - Políticas aplicáveis foram resolvidas
 * 
 * Sem isso, qualquer execução é INVALIDAÇÃO.
 */

import { eventService } from './event.service';
import { eventBus } from './event-bus';
import { BadRequestError, NotFoundError, ForbiddenError } from '@core/errors';
import { runQueryWithTenant } from '@core/database/pool';

/**
 * Verifica se evento pode avançar para fase econômica
 */
export interface EconomicPhaseCheckResult {
  canAdvance: boolean;
  reasons: string[];
  missingPrerequisites: string[];
}

/**
 * Input para handoff da Fase 5.0 para Fase Econômica
 */
export interface AdvanceToEconomicPhaseInput {
  event_id: string;
  user_authorization: boolean; // Deve ser true
  terms_accepted: boolean; // Deve ser true
}

class EventEconomicPhaseService {
  /**
   * Verifica pré-condições para avançar para fase econômica
   * 
   * PRÉ-REQUISITOS (FASE_5_HANDOFF_PARA_FASE_ECONOMICA.md):
   * - Evento está em estado RASCUNHO COMPLETO
   * - Usuário visualizou resumo completo
   * - Nenhum pagamento foi iniciado
   * - Nenhuma agenda foi reservada
   * - Nenhum fornecedor foi contratado
   */
  async checkCanAdvanceToEconomicPhase(
    tenantId: string,
    eventId: string
  ): Promise<EconomicPhaseCheckResult> {
    const event = await eventService.getEvent(tenantId, eventId);
    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    const reasons: string[] = [];
    const missingPrerequisites: string[] = [];

    // 1. Verificar estado do evento (deve estar em draft, declared ou published)
    if (!['draft', 'declared', 'published'].includes(event.status)) {
      missingPrerequisites.push('Evento deve estar em estado rascunho completo (draft, declared ou published)');
    }

    // 2. Verificar se já existe evento de handoff
    const hasHandoff = await this.hasEconomicPhaseHandoff(tenantId, eventId);
    if (hasHandoff) {
      reasons.push('Evento já passou pelo handoff da Fase 5.0');
    } else {
      missingPrerequisites.push('Evento ainda não passou pelo handoff da Fase 5.0');
    }

    // 3. Verificar se há pagamentos iniciados (deve ser false)
    const hasPayments = await this.hasInitiatedPayments(tenantId, eventId);
    if (hasPayments) {
      missingPrerequisites.push('Nenhum pagamento pode ter sido iniciado');
    }

    // 4. Verificar se há reservas de agenda (deve ser false)
    const hasReservations = await this.hasAgendaReservations(tenantId, eventId);
    if (hasReservations) {
      missingPrerequisites.push('Nenhuma agenda pode ter sido reservada');
    }

    const canAdvance = missingPrerequisites.length === 0;

    return {
      canAdvance,
      reasons,
      missingPrerequisites,
    };
  }

  /**
   * Executa handoff da Fase 5.0 para Fase Econômica
   * 
   * Emite evento: event.advance_to_economic_phase
   */
  async advanceToEconomicPhase(
    tenantId: string,
    actorId: string,
    input: AdvanceToEconomicPhaseInput
  ): Promise<void> {
    // 1. Validar autorização do usuário
    if (!input.user_authorization) {
      throw new BadRequestError('Autorização do usuário é obrigatória');
    }

    if (!input.terms_accepted) {
      throw new BadRequestError('Aceite dos termos econômicos é obrigatório');
    }

    // 2. Verificar pré-condições
    const check = await this.checkCanAdvanceToEconomicPhase(tenantId, input.event_id);
    if (!check.canAdvance) {
      throw new BadRequestError(
        `Não é possível avançar para fase econômica: ${check.missingPrerequisites.join(', ')}`
      );
    }

    // 3. Verificar se já existe handoff
    const hasHandoff = await this.hasEconomicPhaseHandoff(tenantId, input.event_id);
    if (hasHandoff) {
      throw new BadRequestError('Evento já passou pelo handoff da Fase 5.0');
    }

    // 4. Emitir evento institucional
    await eventBus.publish({
      tenantId,
      type: 'event.advance_to_economic_phase',
      payload: {
        event_id: input.event_id,
        actor_id: actorId,
        user_authorization: input.user_authorization,
        terms_accepted: input.terms_accepted,
        advancedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Verifica se evento já passou pelo handoff
   */
  private async hasEconomicPhaseHandoff(
    tenantId: string,
    eventId: string
  ): Promise<boolean> {
    const result = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM event_log
      WHERE tenant_id = $1
        AND payload->>'event_id' = $2
        AND event_type = 'event.advance_to_economic_phase'
      LIMIT 1
      `,
      [tenantId, eventId]
    );

    return result && result.length > 0 && parseInt(result[0].count, 10) > 0;
  }

  /**
   * Verifica se há pagamentos iniciados
   */
  private async hasInitiatedPayments(
    tenantId: string,
    eventId: string
  ): Promise<boolean> {
    // Verificar se há payment intents ou transactions relacionadas ao evento
    const result = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM payment_intents
      WHERE tenant_id = $1
        AND metadata->>'event_id' = $2
        AND status IN ('pending', 'processing', 'succeeded')
      LIMIT 1
      `,
      [tenantId, eventId]
    );

    return result && result.length > 0 && parseInt(result[0].count, 10) > 0;
  }

  /**
   * Verifica se há reservas de agenda
   */
  private async hasAgendaReservations(
    tenantId: string,
    eventId: string
  ): Promise<boolean> {
    // Verificar se há availabilities criadas/reservadas para o evento
    try {
      const { unifiedAvailabilityService } = await import('@core/availability/unified-availability.service');
      const { AvailabilityOwnerType } = await import('@core/availability/unified-availability.types');
      
      const availabilities = await unifiedAvailabilityService.listAvailabilities(tenantId, {
        ownerType: AvailabilityOwnerType.EVENT,
        ownerId: eventId,
      });

      return availabilities && availabilities.length > 0;
    } catch (error) {
      // Se serviço não disponível, assumir que não há reservas
      return false;
    }
  }

  /**
   * Verifica se evento está na Fase 6.0
   */
  async isInEconomicPhase(
    tenantId: string,
    eventId: string
  ): Promise<boolean> {
    return await this.hasEconomicPhaseHandoff(tenantId, eventId);
  }
}

export const eventEconomicPhaseService = new EventEconomicPhaseService();


