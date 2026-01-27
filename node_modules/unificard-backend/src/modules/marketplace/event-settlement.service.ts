// backend/src/modules/marketplace/event-settlement.service.ts
// SPRINT 84: EVENT SETTLEMENT + BILHETERIA FINANCEIRA

import { eventSettlementRepository } from './event-settlement.repository';
import type {
  EventSettlement,
  CreateEventSettlementInput,
  SettleEventSettlementInput,
} from './event-settlement.types';

/**
 * Service para Settlements de Eventos
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Evento ≠ Empresa
 * - Evento ≠ Payout
 * - Tudo explícito
 * - Nada automático
 */
class EventSettlementService {
  /**
   * Cria settlement de evento a partir do evento
   * 
   * SPRINT 84: Calcula receita bruta, comissões e taxas regionais
   */
  async createFromEvent(
    tenantId: string,
    input: CreateEventSettlementInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<EventSettlement> {
    // Validar valores
    if (input.grossRevenue < 0) {
      throw new Error('grossRevenue deve ser maior ou igual a zero');
    }

    const commissionsAmount = input.commissionsAmount || 0;
    const regionalFeeAmount = input.regionalFeeAmount || 0;

    if (commissionsAmount < 0) {
      throw new Error('commissionsAmount deve ser maior ou igual a zero');
    }

    if (regionalFeeAmount < 0) {
      throw new Error('regionalFeeAmount deve ser maior ou igual a zero');
    }

    // Criar settlement
    const settlement = await eventSettlementRepository.createSettlement(
      tenantId,
      input,
      createdByActorId,
      createdByUserId || null
    );

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'EVENT_SETTLEMENT_CREATED',
      settlementId: settlement.id,
      eventId: input.eventId,
      grossRevenue: input.grossRevenue,
      commissionsAmount,
      regionalFeeAmount,
      createdByActorId,
      createdByUserId,
    });

    return settlement;
  }

  /**
   * Liquida settlement de evento
   * 
   * SPRINT 84: Vincula ao settlement core existente
   */
  async settleEvent(
    tenantId: string,
    settlementId: string,
    input: SettleEventSettlementInput,
    settledByActorId: string,
    settledByUserId?: string
  ): Promise<EventSettlement> {
    // Buscar settlement
    const settlement = await eventSettlementRepository.getSettlementById(tenantId, settlementId);
    if (!settlement) {
      throw new Error(`Event settlement não encontrado: ${settlementId}`);
    }

    if (settlement.status !== 'PENDING') {
      throw new Error(`Event settlement deve estar PENDING. Status atual: ${settlement.status}`);
    }

    // Marcar como SETTLED
    const settledSettlement = await eventSettlementRepository.markAsSettled(
      tenantId,
      settlementId,
      input.settlementId || null,
      settledByActorId,
      settledByUserId || null
    );

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'EVENT_SETTLEMENT_SETTLED',
      settlementId: settledSettlement.id,
      eventId: settledSettlement.eventId,
      settlementCoreId: input.settlementId,
      settledByActorId,
      settledByUserId,
    });

    return settledSettlement;
  }

  /**
   * Busca settlement por evento
   */
  async getSettlementByEvent(
    tenantId: string,
    eventId: string
  ): Promise<EventSettlement | null> {
    return eventSettlementRepository.getSettlementByEvent(tenantId, eventId);
  }

  /**
   * Registra auditoria
   */
  private async recordAudit(
    tenantId: string,
    data: Record<string, any>
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, data);
    } catch (error) {
      // Não bloquear se auditoria falhar
      console.warn('[EventSettlementService] Erro ao registrar auditoria:', error);
    }
  }
}

export const eventSettlementService = new EventSettlementService();





