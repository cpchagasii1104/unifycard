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
  snapshot_id: string;
  actor_id: string;
  actor_type: 'store' | 'service_provider';
  period: {
    year: number;
    month: number; // 1-12
  };
  total_fixed_cost: number; // Soma de todos os custos fixos
  average_variable_cost: number; // Custo variável médio
  average_price: number; // Preço médio praticado (baseado em vendas reais)
  break_even_volume: number; // Volume necessário para cobrir custos fixos
  current_margin_percentage: number; // Margem atual (percentual)
  sustainability_status: 'healthy' | 'warning' | 'critical';
  calculation_explanation: string; // Texto canônico, determinístico
  currency: string;
  created_at: string;
  // NÃO incluir updated_at - snapshot é imutável
}





