// backend/src/contracts/marketplace/RegionalImpactMetrics.contract.ts
// CONTRATO PÚBLICO CONGELADO - RegionalImpactMetrics (Métricas de Impacto Regional)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * RegionalImpactMetrics - Métricas de Impacto Regional do Marketplace
 * 
 * Métricas econômicas regionais determinísticas, baseadas EXCLUSIVAMENTE em eventos reais do sistema.
 * Nada estimado. Nada manual. Nada "dashboard bonito sem lastro".
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface RegionalImpactMetrics {
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
  totalTransactionsAmount: number; // Total movimentado no período
  totalOrdersCount: number; // Número de pedidos executados
  totalServicesCount: number; // Número de serviços confirmados
  totalSubscriptionsActive: number; // Número de assinaturas ativas no período
  totalStoresActive: number; // Número de lojas ativas (com pedidos)
  totalIndustrialProductsActive: number; // Número de produtos industriais ativados
  regionalFundInflow: number; // Entrada no fundo regional
  regionalFundOutflow: number; // Saída do fundo regional
  averageTicket: number; // Ticket médio (totalTransactionsAmount / totalOrdersCount)
  currency: string; // Moeda (ex: 'BRL')
  generatedAt: string; // Timestamp de geração (imutável)
  // NÃO incluir updatedAt - snapshot é imutável
}





