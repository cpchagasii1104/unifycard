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
  snapshotId: string;
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
      totalAmountCents: number;
      platformRevenueCents: number;
      regionalFundRevenueCents: number;
      infrastructureCostCents: number; // Debitado do Fundo Regional
    };
    b2b: {
      totalAmountCents: number;
      platformRevenueCents: number;
      regionalFundRevenueCents: number;
    };
    subscription: {
      totalAmountCents: number;
      platformRevenueCents: number;
      regionalFundRevenueCents: number;
    };
    terminal: {
      totalAmountCents: number;
      platformRevenueCents: number;
      regionalFundRevenueCents: number;
      infrastructureCostCents: number;
    };
    logistics: {
      totalAmountCents: number;
      platformRevenueCents: number;
      regionalFundRevenueCents: number;
    };
  };
  // Totais
  totalTransactedCents: number; // Total movimentado
  totalFeesCents: number; // Total de taxas
  totalPlatformRevenueCents: number; // Total receita da plataforma
  totalRegionalFundRevenueCents: number; // Total receita do Fundo Regional
  totalInfrastructureCostCents: number; // Total custo de infraestrutura (debitado do Fundo Regional)
  totalIncentivesCents: number; // Total de incentivos concedidos
  currency: string;
  createdAt: string;
  // NÃO incluir updatedAt - snapshot é imutável
}





