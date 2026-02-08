// backend/src/contracts/marketplace/EconomicSustainabilitySnapshot.contract.ts
// CONTRATO PÚBLICO CONGELADO - EconomicSustainabilitySnapshot (Snapshot de Sustentabilidade Econômica)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * EconomicSustainabilitySnapshot - Snapshot de Sustentabilidade Econômica (Imutável)
 * 
 * Análise determinística da saúde econômica do negócio.
 * Baseado exclusivamente em dados reais e regras fixas.
 * 
 * NÃO influencia preços, rankings ou trust diretamente.
 * Apenas ferramenta de leitura para o comerciante.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface EconomicSustainabilitySnapshot {
  snapshotId: string;
  actorId: string;
  actorType: 'store' | 'service_provider';
  period: {
    year: number;
    month: number; // 1-12
  };
  totalFixedCost: number; // Soma de todos os custos fixos
  averageVariableCost: number; // Custo variável médio
  averagePrice: number; // Preço médio praticado (baseado em vendas reais)
  breakEvenVolume: number; // Volume necessário para cobrir custos fixos
  currentMarginPercentage: number; // Margem atual (percentual)
  sustainabilityStatus: 'healthy' | 'warning' | 'critical';
  calculationExplanation: string; // Texto canônico, determinístico
  currency: string;
  createdAt: string;
  // NÃO incluir updatedAt - snapshot é imutável
}





