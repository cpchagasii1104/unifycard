// backend/src/core/economy/distribution/distribution.service.ts

import type { FeeConfig, FeeCalculation } from './distribution.types';

/**
 * Configuração padrão de fees
 * Pode ser sobrescrita por tenant ou por transação
 */
const DEFAULT_FEE_CONFIG: FeeConfig = {
  platformFeePercent: 2.5, // 2.5%
  communityFeePercent: 1.0, // 1.0%
  groupFeePercent: 0.5, // 0.5%
};

class DistributionService {
  /**
   * Calcula fees de uma transação
   * 
   * @param amount - Valor da transação
   * @param config - Configuração de fees (opcional, usa default se não fornecido)
   * @returns Cálculo detalhado dos fees
   */
  calculateFees(amountCents: number, config: Partial<FeeConfig> = {}): FeeCalculation {
    const finalConfig: FeeConfig = {
      ...DEFAULT_FEE_CONFIG,
      ...config,
    };

    // Calcula cada fee
    const platformFee = (amountCents * finalConfig.platformFeePercent) / 100;
    const communityFee = (amountCents * finalConfig.communityFeePercent) / 100;
    const groupFee = (amountCents * finalConfig.groupFeePercent) / 100;

    // Total de fees
    const totalFees = platformFee + communityFee + groupFee;

    // Valor líquido que chega ao destinatário
    const netAmount = amountCents - totalFees;

    return {
      originalAmount: amountCents,
      platformFee: Math.round(platformFee * 100) / 100, // Arredonda para 2 decimais
      communityFee: Math.round(communityFee * 100) / 100,
      groupFee: Math.round(groupFee * 100) / 100,
      totalFees: Math.round(totalFees * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100,
    };
  }


  /**
   * Recalcula fees em lote (útil para ajustes de configuração)
   * 
   * NOTA: Isso NÃO cria transações, apenas calcula quanto seria
   * distribuído com as novas configurações.
   */
  async batchRecalculateFees(
    amounts: number[],
    config: Partial<FeeConfig> = {}
  ): Promise<FeeCalculation[]> {
    return amounts.map((amount) => this.calculateFees(amount, config));
  }

  /**
   * Simula uma distribuição sem executar
   * Útil para preview antes de confirmar
   */
  async simulateDistribution(
    amountCents: number,
    config: Partial<FeeConfig> = {}
  ): Promise<FeeCalculation> {
    return this.calculateFees(amountCents, config);
  }

  /**
   * Busca configuração de fees de um tenant
   * (Por enquanto retorna default, mas pode ser estendido para config por tenant no DB)
   */
  async getFeeConfig(_tenantId: string): Promise<FeeConfig> {
    // TODO: Buscar do banco se tenant tiver config customizada
    return DEFAULT_FEE_CONFIG;
  }

  /**
   * Atualiza configuração de fees de um tenant
   * (Implementação futura: salvar no banco)
   */
  async updateFeeConfig(_tenantId: string, _config: Partial<FeeConfig>): Promise<FeeConfig> {
    // TODO: Salvar no banco
    throw new Error('Not implemented yet');
  }
}

export const distributionService = new DistributionService();
