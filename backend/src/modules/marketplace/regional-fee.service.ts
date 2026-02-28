// backend/src/modules/marketplace/regional-fee.service.ts
// SPRINT 83: TAXA REGIONAL + ECONOMIA COMUNITÁRIA

import type { AuditEventInput } from '@core/audit/audit.service';
import { regionalFeeRepository } from './regional-fee.repository';
import type {
  RegionalFee,
  CreateRegionalFeeInput,
  RegionalFeeFilters,
  RegionalFeeSummary,
} from './regional-fee.types';

/**
 * Service para Taxas Regionais
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Fee ≠ Split
 * - Fee ≠ Payout
 * - Fee ≠ Tax
 * - Nenhuma execução automática externa
 * - Apenas modelagem e registro
 */
class RegionalFeeService {
  /**
   * Cria taxa regional (snapshot)
   */
  async createFee(
    tenantId: string,
    input: CreateRegionalFeeInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<RegionalFee> {
    // Validar valores
    if (input.grossAmount < 0) {
      throw new Error('grossAmount deve ser maior ou igual a zero');
    }

    if (input.feeBps < 0) {
      throw new Error('feeBps deve ser maior ou igual a zero');
    }

    if (input.feeAmount < 0) {
      throw new Error('feeAmount deve ser maior ou igual a zero');
    }

    // Criar taxa
    const fee = await regionalFeeRepository.createFee(tenantId, input);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'REGIONAL_FEE_CREATED',
      feeId: fee.id,
      regionId: input.regionId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      grossAmount: input.grossAmount,
      feeBps: input.feeBps,
      feeAmount: input.feeAmount,
      createdByActorId,
      createdByUserId,
    });

    return fee;
  }

  /**
   * Lista taxas com filtros
   */
  async listFees(
    tenantId: string,
    filters: RegionalFeeFilters = {}
  ): Promise<RegionalFee[]> {
    return regionalFeeRepository.listFees(tenantId, filters);
  }

  /**
   * Busca taxas por região
   */
  async getFeesByRegion(
    tenantId: string,
    regionId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<RegionalFee[]> {
    return regionalFeeRepository.getFeesByRegion(tenantId, regionId, startDate, endDate);
  }

  /**
   * Resume taxas por período
   */
  async summarizeByPeriod(
    tenantId: string,
    regionId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<RegionalFeeSummary> {
    const fees = await regionalFeeRepository.getFeesByRegion(
      tenantId,
      regionId,
      periodStart,
      periodEnd
    );

    const totalFees = fees.reduce((sum, fee) => sum + fee.feeAmount, 0);
    const feeCount = fees.length;

    // Agrupar por sourceType
    const bySourceType: Record<string, { totalFees: number; feeCount: number }> = {};
    
    fees.forEach((fee) => {
      if (!bySourceType[fee.sourceType]) {
        bySourceType[fee.sourceType] = { totalFees: 0, feeCount: 0 };
      }
      bySourceType[fee.sourceType].totalFees += fee.feeAmount;
      bySourceType[fee.sourceType].feeCount += 1;
    });

    return {
      regionId,
      periodStart,
      periodEnd,
      totalFees,
      feeCount,
      bySourceType: bySourceType as any,
    };
  }

  /**
   * Vincula taxa a settlement (quando liquidado)
   */
  async linkToSettlement(
    tenantId: string,
    feeId: string,
    settlementId: string
  ): Promise<RegionalFee> {
    const fee = await regionalFeeRepository.updateSettlementId(
      tenantId,
      feeId,
      settlementId
    );

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'REGIONAL_FEE_LINKED_TO_SETTLEMENT',
      feeId,
      settlementId,
    });

    return fee;
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
      console.warn('[RegionalFeeService] Erro ao registrar auditoria:', error);
    }
  }
}

export const regionalFeeService = new RegionalFeeService();





