// backend/src/modules/marketplace/pricing-strategy.types.ts
// SPRINT 63: Tipos para estratégia de preço assistida (read-only)

import type { ConfidenceLevel } from './decision-simulation.types';
import type { DecisionSimulationResult } from './decision-simulation.types';

/**
 * Insight de estratégia de preço
 * 
 * ⚠️ READ-ONLY: Não é persistido, apenas calculado
 */
export interface PricingStrategyInsight {
  productVariantId: string;
  actorId?: string;
  channel?: 'PDV' | 'MARKETPLACE';
  
  // Preço atual
  currentPrice: number;
  
  // Faixa sugerida (nunca valor único)
  suggestedPriceRange: {
    min: number; // Preço mínimo recomendado
    max: number; // Preço máximo recomendado
    optimal?: number; // Preço ótimo estimado (dentro da faixa)
  };
  
  // Impacto na margem
  marginImpact: {
    currentMargin: number; // Margem atual
    minMargin: number; // Margem com preço mínimo
    maxMargin: number; // Margem com preço máximo
    optimalMargin?: number; // Margem com preço ótimo
  };
  
  // Impacto no holding cost
  holdingCostImpact: {
    currentHoldingCost: number; // Custo atual
    estimatedHoldingCostAtMin: number; // Custo estimado com preço mínimo
    estimatedHoldingCostAtMax: number; // Custo estimado com preço máximo
  };
  
  // Sensibilidade da demanda
  demandSensitivity: {
    elasticity: number; // Elasticidade de preço estimada
    priceChangeImpact: {
      // Impacto de mudanças de preço na demanda
      minus10Percent: number; // Variação de demanda com -10% de preço
      minus5Percent: number; // Variação de demanda com -5% de preço
      plus5Percent: number; // Variação de demanda com +5% de preço
      plus10Percent: number; // Variação de demanda com +10% de preço
    };
  };
  
  // Cenários what-if
  scenarios: DecisionSimulationResult[]; // Simulações de diferentes preços
  
  // Explicação
  explanation: string; // Explicação legível da estratégia
  
  // Nível de confiança
  confidenceLevel: ConfidenceLevel;
  
  // Metadados
  metadata: {
    historicalDataPoints?: number; // Número de pontos históricos
    averageDailySales?: number; // Média de vendas diárias
    currentStock?: number; // Estoque atual
    daysInStock?: number; // Dias em estoque (aging)
    [key: string]: any;
  };
}

/**
 * Opções para buscar estratégia de preço
 */
export interface GetPricingStrategyOptions {
  productVariantId: string;
  actorId?: string;
  channel?: 'PDV' | 'MARKETPLACE';
  priceRangeSteps?: number; // Número de passos na faixa (padrão: 5)
  simulationPeriodDays?: number; // Período para simulações (padrão: 30)
}







