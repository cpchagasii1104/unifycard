// backend/src/modules/marketplace/decision-simulation.types.ts
// SPRINT 62: Tipos para simulador de decisão (what-if, read-only)

export type ScenarioType = 'PRICE_CHANGE' | 'DISCOUNT' | 'TRANSFER' | 'REDUCE_STOCK';
export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Resultado de simulação de decisão
 * 
 * ⚠️ READ-ONLY: Não é persistido, apenas calculado
 */
export interface DecisionSimulationResult {
  scenarioType: ScenarioType;
  inputParameters: Record<string, any>; // Parâmetros de entrada da simulação
  estimatedRevenue: number; // Receita estimada
  estimatedMargin: number; // Margem estimada
  estimatedHoldingCost: number; // Custo de estoque parado estimado
  estimatedStockAfter: number; // Estoque estimado após simulação
  deltaVsCurrent: {
    revenue: number; // Diferença de receita vs atual
    margin: number; // Diferença de margem vs atual
    holdingCost: number; // Diferença de holding cost vs atual
    stock: number; // Diferença de estoque vs atual
  };
  explanation: string; // Explicação legível
  confidenceLevel: ConfidenceLevel; // Nível de confiança da simulação
  metadata: {
    historicalDataPoints?: number; // Número de pontos históricos usados
    averageDailySales?: number; // Média de vendas diárias (histórico)
    currentPrice?: number; // Preço atual
    currentStock?: number; // Estoque atual
    [key: string]: any;
  };
}

/**
 * Input para simulação de mudança de preço
 */
export interface SimulatePriceChangeInput {
  productVariantId: string;
  actorId?: string;
  newPrice: number;
  periodDays?: number; // Período para estimar impacto (padrão: 30)
}

/**
 * Input para simulação de desconto
 */
export interface SimulateDiscountInput {
  productVariantId: string;
  actorId?: string;
  discountPercentage?: number; // Desconto percentual (ex: 10 = 10%)
  discountAmount?: number; // Desconto fixo (ex: 5.00)
  periodDays?: number;
}

/**
 * Input para simulação de transferência
 */
export interface SimulateTransferInput {
  productVariantId: string;
  fromActorId: string;
  toActorId: string;
  quantity: number;
}

/**
 * Input para simulação de redução de estoque
 */
export interface SimulateStockReductionInput {
  productVariantId: string;
  actorId: string;
  reductionQuantity: number; // Quantidade a reduzir (positiva)
  reductionType: 'LOSS' | 'DAMAGE' | 'SURPLUS'; // Tipo de ajuste
}

/**
 * Input genérico para simulação
 */
export interface SimulationInput {
  scenarioType: ScenarioType;
  parameters: Record<string, any>;
}







