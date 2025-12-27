/**
 * Tipos de fees suportados
 */
export type FeeType = 'platform_fee' | 'community_fee' | 'group_fee';
/**
 * Configuração de distribuição de fees
 */
export interface FeeConfig {
    platformFeePercent: number;
    communityFeePercent: number;
    groupFeePercent: number;
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
    fromAccount: string;
    toAccount: string;
    amount: number;
    groupAccount?: string;
    config?: Partial<FeeConfig>;
}
//# sourceMappingURL=distribution.types.d.ts.map