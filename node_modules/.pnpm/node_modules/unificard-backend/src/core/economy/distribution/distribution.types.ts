// backend/src/core/economy/distribution/distribution.types.ts

/**
 * Tipos de fees suportados
 */
export type FeeType = 'platform_fee' | 'community_fee' | 'group_fee';

/**
 * Configuração de distribuição de fees
 */
export interface FeeConfig {
  platformFeePercent: number; // Ex: 2.5 = 2.5%
  communityFeePercent: number; // Ex: 1.0 = 1.0%
  groupFeePercent: number; // Ex: 0.5 = 0.5%
}

/**
 * Resultado do cálculo de fees
 */
export interface FeeCalculation {
  originalAmount: number;
  platformFee: number;
  communityFee: number;
  groupFee: number;
  totalFees: number;
  netAmount: number;
}

/**
 * Resultado da distribuição de fees
 */
export interface DistributionResult {
  transactionId: string;
  calculation: FeeCalculation;
  distributions: {
    platformAccount: string;
    communityAccount: string;
    groupAccount?: string;
  };
  eventIds: string[];
}

/**
 * Input para distribuição automática
 */
export interface AutoDistributeInput {
  fromAccount?: string;
  toAccount?: string;
  amountCents: number;
  groupAccount?: string; // Opcional: se houver grupo envolvido
  config?: Partial<FeeConfig>; // Permite override de config
}
