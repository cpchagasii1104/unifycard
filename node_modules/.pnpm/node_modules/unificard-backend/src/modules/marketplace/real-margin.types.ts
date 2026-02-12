// backend/src/modules/marketplace/real-margin.types.ts
// SPRINT 61: Tipos para margem real por produto/canal/filial (read-only)

export type MarginChannel = 'PDV' | 'MARKETPLACE';

/**
 * Relatório de margem real
 * 
 * ⚠️ READ-ONLY: Não é persistido, apenas calculado
 */
export interface RealMarginReport {
  // Identificação
  productVariantId?: string; // Opcional (pode ser agregado por actor/channel)
  actorId?: string; // Opcional (pode ser agregado por variant/channel)
  channel?: MarginChannel; // Opcional (pode ser agregado por variant/actor)
  
  // Receita
  grossRevenue: number; // Receita bruta (sum de priceSnapshot.finalPrice * quantity)
  discounts: number; // Total de descontos aplicados (sum de discountAmount)
  
  // Custos e fees
  platformFees: number; // Fees da plataforma (splits com role = PLATFORM)
  payouts: number; // Payouts para vendedores (splits com role = SELLER)
  holdingCost: number; // Custo de estoque parado (InventoryHoldingCostService)
  
  // Margem
  netMargin: number; // Margem líquida = grossRevenue - platformFees - holdingCost
  marginPercentage: number; // Percentual de margem = (netMargin / grossRevenue) * 100
  
  // Explicação
  explanation: string; // Explicação legível
  
  // Metadados
  metadata: {
    transactionCount?: number; // Número de transações
    orderCount?: number; // Número de pedidos
    averageTicket?: number; // Ticket médio
    periodStart?: Date; // Início do período
    periodEnd?: Date; // Fim do período
    [key: string]: any;
  };
}

/**
 * Opções para buscar margem
 */
export interface GetMarginOptions {
  actorId?: string;
  productVariantId?: string;
  channel?: MarginChannel;
  periodStart?: Date;
  periodEnd?: Date;
  groupBy?: 'variant' | 'actor' | 'channel' | 'all'; // Agrupar por
  limit?: number;
  offset?: number;
}

/**
 * Configuração de cálculo de margem
 */
export interface MarginConfig {
  includeHoldingCost?: boolean; // Incluir custo de estoque parado (padrão: true)
  holdingCostDailyRate?: number; // Taxa diária de holding (padrão: 0.001)
}







