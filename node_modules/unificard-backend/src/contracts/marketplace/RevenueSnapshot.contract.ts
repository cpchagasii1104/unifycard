// backend/src/contracts/marketplace/RevenueSnapshot.contract.ts
// CONTRATO PÚBLICO CONGELADO - RevenueSnapshot (Snapshot de Receita Mensal)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * RevenueSnapshot - Snapshot de Receita Mensal por Região (Imutável)
 * 
 * Monetização sem ads, baseada em uso real do sistema.
 * Snapshot mensal imutável por região.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export type RevenueSource = 'transaction' | 'b2b' | 'subscription' | 'terminal' | 'logistics';

export interface RevenueSnapshot {
  snapshot_id: string;
  region: {
    country: string;
    state: string;
    city: string;
  };
  period: {
    year: number;
    month: number; // 1-12
  };
  // Receitas por fonte
  revenues: {
    transaction: {
      total_amount: number;
      platform_revenue: number;
      regional_fund_revenue: number;
      infrastructure_cost: number; // Debitado do Fundo Regional
    };
    b2b: {
      total_amount: number;
      platform_revenue: number;
      regional_fund_revenue: number;
    };
    subscription: {
      total_amount: number;
      platform_revenue: number;
      regional_fund_revenue: number;
    };
    terminal: {
      total_amount: number;
      platform_revenue: number;
      regional_fund_revenue: number;
      infrastructure_cost: number;
    };
    logistics: {
      total_amount: number;
      platform_revenue: number;
      regional_fund_revenue: number;
    };
  };
  // Totais
  total_transacted: number; // Total movimentado
  total_fees: number; // Total de taxas
  total_platform_revenue: number; // Total receita da plataforma
  total_regional_fund_revenue: number; // Total receita do Fundo Regional
  total_infrastructure_cost: number; // Total custo de infraestrutura (debitado do Fundo Regional)
  total_incentives: number; // Total de incentivos concedidos
  currency: string;
  created_at: string;
  // NÃO incluir updated_at - snapshot é imutável
}





