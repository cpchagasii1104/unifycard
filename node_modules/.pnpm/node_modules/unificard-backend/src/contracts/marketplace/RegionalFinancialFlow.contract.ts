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
  totalTransactedCents: number; // Total transacionado
  totalFeesCents: number; // Total de taxas
  // Destino das taxas
  regionalFund: {
    totalRevenueCents: number; // Total recebido pelo Fundo Regional
    infrastructureCostCents: number; // Total gasto em infraestrutura
    netBalanceCents: number; // Saldo líquido (receita - custos)
  };
  platform: {
    totalRevenueCents: number; // Total recebido pela Plataforma
  };
  infrastructure: {
    totalCostCents: number; // Total custo de infraestrutura
    fundedByRegionalFundCents: number; // Financiado pelo Fundo Regional
  };
  incentives: {
    totalGrantedCents: number; // Total de incentivos concedidos
  };
  currency: string;
  generatedAt: string;
}





