// backend/src/modules/marketplace/settlement.service.ts
// SPRINT 77: SETTLEMENT REGIONAL + UNIFYBANK CORE

import type {
  Settlement,
  CreateSettlementFromPaymentInput,
  SettlementFilters,
} from './settlement.types';

/** Repos migrados para Bank - fail-fast até migração */
const settlementRepository = new Proxy({} as any, {
  get: () => () => Promise.reject(new Error('Settlement migrated to Bank')),
});
const regionAccountRepository = new Proxy({} as any, {
  get: () => () => Promise.reject(new Error('RegionAccount migrated to Bank')),
});

/**
 * Service para Settlements
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Settlement ≠ Payout
 * - Settlement ≠ Split
 * - Settlement ≠ Payment
 * - Tudo explícito e auditável
 * - Nada automático sem ação explícita
 */
class SettlementService {
  /**
   * Cria settlement a partir de pagamento
   * 
   * SPRINT 77: Chamado quando PaymentExecution é SUCCESS
   */
  async createFromPayment(
    tenantId: string,
    input: CreateSettlementFromPaymentInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<Settlement> {
    // Validar valores
    if (input.grossAmountCents < 0) {
      throw new Error('grossAmountCents deve ser maior ou igual a zero');
    }

    if (input.feeAmountCents < 0) {
      throw new Error('feeAmountCents deve ser maior ou igual a zero');
    }

    if (input.feeAmountCents > input.grossAmountCents) {
      throw new Error('feeAmountCents não pode ser maior que grossAmountCents');
    }

    const netAmountCents = input.grossAmountCents - input.feeAmountCents;

    // Criar settlement
    const settlement = await settlementRepository.createSettlement(tenantId, {
      regionId: input.regionId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      grossAmountCents: input.grossAmountCents,
      feeAmountCents: input.feeAmountCents,
      netAmountCents,
      currency: 'BRL', // Por enquanto apenas BRL
      createdByActorId,
      createdByUserId: createdByUserId || null,
      metadata: input.metadata || {},
    });

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'SETTLEMENT_CREATED',
      settlementId: settlement.id,
      regionId: input.regionId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      createdByActorId,
      createdByUserId,
    });

    return settlement;
  }

  /**
   * Liquida settlement (credita RegionAccount)
   * 
   * SPRINT 77: Chamado por ScheduledAction ou manualmente
   */
  async settle(
    tenantId: string,
    settlementId: string,
    settledByActorId: string,
    settledByUserId?: string
  ): Promise<Settlement> {
    // Buscar settlement
    const settlement = await settlementRepository.getSettlementById(tenantId, settlementId);
    if (!settlement) {
      throw new Error(`Settlement não encontrado: ${settlementId}`);
    }

    if (settlement.status !== 'PENDING') {
      throw new Error(`Settlement deve estar PENDING. Status atual: ${settlement.status}`);
    }

    // Se fee_amount_cents > 0, creditar na conta regional
    if (settlement.feeAmountCents > 0) {
      try {
        // Buscar ou criar conta regional
        const regionAccount = await regionAccountRepository.getOrCreateAccount(
          tenantId,
          settlement.regionId,
          settlement.currency
        );

        // Creditar taxa na conta regional
        await regionAccountRepository.credit(
          tenantId,
          settlement.regionId,
          settlement.feeAmountCents,
          settlement.currency
        );
      } catch (accountError) {
        // Se falhar ao creditar, marcar settlement como FAILED
        const failedSettlement = await settlementRepository.markAsFailed(
          tenantId,
          settlementId,
          `Erro ao creditar conta regional: ${accountError instanceof Error ? accountError.message : String(accountError)}`
        );

        // Registrar auditoria de falha
        await this.recordAudit(tenantId, {
          eventType: 'SETTLEMENT_FAILED',
          settlementId: failedSettlement.id,
          failureReason: failedSettlement.failureReason,
        });

        throw accountError;
      }
    }

    // Marcar settlement como SETTLED
    const settledSettlement = await settlementRepository.markAsSettled(
      tenantId,
      settlementId,
      settledByActorId,
      settledByUserId || null
    );

    // SPRINT 83: Criar regional_fee (snapshot) quando settlement é liquidado
    if (settledSettlement.feeAmountCents > 0) {
      try {
        const { regionalFeeService } = await import('./regional-fee.service');
        
        // Calcular fee_percentage baseado em gross e fee
        const feePercentage = settledSettlement.grossAmountCents > 0
          ? (settledSettlement.feeAmountCents / settledSettlement.grossAmountCents) * 100
          : 0;

        // Criar regional_fee (snapshot)
        await regionalFeeService.createFee(
          tenantId,
          {
            regionId: settledSettlement.regionId,
            sourceType: settledSettlement.sourceType === 'TICKET' ? 'EVENT' : 'PAYMENT',
            sourceId: settledSettlement.sourceId,
            grossAmount: settledSettlement.grossAmountCents,
            feeBps: Math.round(feePercentage * 100),
            feeAmount: settledSettlement.feeAmountCents,
            settlementId: settledSettlement.id,
            metadata: {
              settlement_id: settledSettlement.id,
              source_type: settledSettlement.sourceType,
            },
          },
          settledByActorId,
          settledByUserId
        );
      } catch (feeError) {
        // Log mas não bloqueia liquidação do settlement
        console.warn(`[SettlementService] Erro ao criar regional_fee para settlement ${settlementId}:`, feeError);
      }
    }

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'SETTLEMENT_SETTLED',
      settlementId: settledSettlement.id,
      regionId: settledSettlement.regionId,
      feeAmountCents: settledSettlement.feeAmountCents,
      settledByActorId,
      settledByUserId,
    });

    return settledSettlement;
  }

  /**
   * Lista settlements
   */
  async listSettlements(
    tenantId: string,
    filters: SettlementFilters = {}
  ): Promise<Settlement[]> {
    return await settlementRepository.listSettlements(tenantId, filters);
  }

  /**
   * Busca settlement por ID
   */
  async getSettlementById(tenantId: string, settlementId: string): Promise<Settlement | null> {
    return await settlementRepository.getSettlementById(tenantId, settlementId);
  }

  private async recordAudit(
    tenantId: string,
    data: {
      eventType: string;
      settlementId: string;
      regionId?: string;
      sourceType?: string;
      sourceId?: string;
      feeAmountCents?: number;
      failureReason?: string | null;
      createdByActorId?: string;
      createdByUserId?: string | null;
      settledByActorId?: string;
      settledByUserId?: string | null;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'medium',
        actor_id: (data.createdByActorId || data.settledByActorId) ?? undefined,
        actor_type: 'user',
        source: 'settlements',
        context: {
          settlement_id: data.settlementId,
          region_id: data.regionId,
          source_type: data.sourceType,
          source_id: data.sourceId,
          fee_amount_cents: data.feeAmountCents,
          failure_reason: data.failureReason,
          created_by_actor_id: data.createdByActorId,
          created_by_user_id: data.createdByUserId ?? undefined,
          settled_by_actor_id: data.settledByActorId,
          settled_by_user_id: data.settledByUserId ?? undefined,
        },
      });
    } catch (error) {
      console.warn('[Settlement] Erro ao registrar auditoria:', error);
    }
  }
}

export const settlementService = new SettlementService();

