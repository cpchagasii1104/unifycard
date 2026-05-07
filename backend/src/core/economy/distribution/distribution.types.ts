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

