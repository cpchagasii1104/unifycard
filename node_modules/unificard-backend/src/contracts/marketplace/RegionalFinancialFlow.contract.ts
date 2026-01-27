// backend/src/contracts/marketplace/RegionalFinancialFlow.contract.ts
// CONTRATO PÚBLICO CONGELADO - RegionalFinancialFlow (Fluxo Financeiro Regional)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * RegionalFinancialFlow - Fluxo Financeiro Regional (Transparência Total)
 * 
 * Endpoint público para transparência financeira regional.
 * Nada agregável por empresa individual (somente região).
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface RegionalFinancialFlow {
  region: {
    country: string;
    state: string;
    city: string;
  };
  period: {
    year: number;
    month: number; // 1-12
  };
  // Totais
  total_transacted: number; // Total transacionado
  total_fees: number; // Total de taxas
  // Destino das taxas
  regional_fund: {
    total_revenue: number; // Total recebido pelo Fundo Regional
    infrastructure_cost: number; // Total gasto em infraestrutura
    net_balance: number; // Saldo líquido (receita - custos)
  };
  platform: {
    total_revenue: number; // Total recebido pela Plataforma
  };
  infrastructure: {
    total_cost: number; // Total custo de infraestrutura
    funded_by_regional_fund: number; // Financiado pelo Fundo Regional
  };
  incentives: {
    total_granted: number; // Total de incentivos concedidos
  };
  currency: string;
  generated_at: string;
}





