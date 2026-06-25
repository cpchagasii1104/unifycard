// backend/src/modules/marketplace/event-settlement.service.ts
// SPRINT 84: EVENT SETTLEMENT + BILHETERIA FINANCEIRA

import type { AuditEventInput } from '@core/audit/audit.service';
import { eventSettlementRepository } from './event-settlement.repository';
import { assertEventSettlementRuntimeEnabled } from './event-settlement-financial-firewall';
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
      createdByUserId ?? undefined
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
    // 🔴 F-EVENT-SETTLEMENT-STATUS-HOLD-CONTAINMENT — FAIL-CLOSED default-off ANTES de qualquer leitura/transição
    // de estado financeiro (markAsSettled: event_settlements.status='SETTLED'). NÃO é money-write em bank_*, mas
    // é estado financeiro sensível; contido enquanto dinheiro/event-settlement está HOLD (PORTA-1). Reabrir = flag.
    assertEventSettlementRuntimeEnabled('POST /events/:id/settlement/settle');

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

      const {
        event_type,
        eventType,
        severity,
        source,
        actor_id,
        actorId,
        actor_type,
        actorType,
        company_id,
        companyId,
        employee_id,
        employeeId,
        ...rest
      } = data;

      const finalEventType = event_type ?? eventType;
      if (!finalEventType) {
        throw new Error('Audit event_type is required');
      }

      const auditInput: AuditEventInput = {
        event_type: finalEventType,
        severity: severity ?? 'low',
        source: source ?? 'validation',
        actor_id: actor_id ?? actorId ?? undefined,
        actor_type: actor_type ?? actorType ?? undefined,
        company_id: company_id ?? companyId ?? undefined,
        employee_id: employee_id ?? employeeId ?? undefined,
        context: {
          ...rest,
        },
      };

      await auditService.record(tenantId, auditInput);
    } catch (error) {
      console.warn('[EventSettlementService] Erro ao registrar auditoria:', error);
    }
  }
}

export const eventSettlementService = new EventSettlementService();





