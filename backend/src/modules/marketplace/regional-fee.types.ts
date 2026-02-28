// backend/src/modules/marketplace/regional-fee.types.ts
// SPRINT 83: TAXA REGIONAL + ECONOMIA COMUNITÁRIA

/**
 * Tipo de origem da taxa regional
 */
export type RegionalFeeSourceType = 'PAYMENT' | 'EVENT' | 'SUBSCRIPTION';

/**
 * Taxa Regional
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Fee ≠ Split
 * - Fee ≠ Payout
 * - Fee ≠ Tax
 * - Nenhuma execução automática externa
 * - Apenas modelagem e registro
 */
export interface RegionalFee {
  id: string;
  tenantId: string;
  regionId: string;
  sourceType: RegionalFeeSourceType;
  sourceId: string;
  grossAmount: number; // em centavos
  feeBps: number; // ex: 350 = 3.5%
  feeAmount: number; // em centavos
  settlementId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

/**
 * Input para criar taxa regional
 */
export interface CreateRegionalFeeInput {
  regionId: string;
  sourceType: RegionalFeeSourceType;
  sourceId: string;
  grossAmount: number; // em centavos
  feeBps: number; // ex: 350 = 3.5%
  feeAmount: number; // em centavos
  settlementId?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Filtros para listar taxas regionais
 */
export interface RegionalFeeFilters {
  regionId?: string;
  sourceType?: RegionalFeeSourceType;
  sourceId?: string;
  settlementId?: string | null;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Resumo de taxas por período
 */
export interface RegionalFeeSummary {
  regionId: string;
  periodStart: Date;
  periodEnd: Date;
  totalFees: number; // em centavos
  feeCount: number;
  bySourceType: Record<RegionalFeeSourceType, {
    totalFees: number;
    feeCount: number;
  }>;
}






