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
  total_transactions_amount: number; // Total movimentado no período
  total_orders_count: number; // Número de pedidos executados
  total_services_count: number; // Número de serviços confirmados
  total_subscriptions_active: number; // Número de assinaturas ativas no período
  total_stores_active: number; // Número de lojas ativas (com pedidos)
  total_industrial_products_active: number; // Número de produtos industriais ativados
  regional_fund_inflow: number; // Entrada no fundo regional
  regional_fund_outflow: number; // Saída do fundo regional
  average_ticket: number; // Ticket médio (total_transactions_amount / total_orders_count)
  currency: string; // Moeda (ex: 'BRL')
  generated_at: string; // Timestamp de geração (imutável)
  // NÃO incluir updated_at - snapshot é imutável
}





