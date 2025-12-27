// src/core/catalog/dynamic-pricing/dynamic-pricing.types.ts
// Tipos para simulação de preço dinâmico - READ-ONLY

/**
 * Simulação de preço dinâmico
 * Apenas observa e simula, não executa mudanças
 */
export interface DynamicPricingSimulation {
  productId: string;
  cityId: string;
  currentPrice: number;
  simulatedPrice: number | null; // null se dados insuficientes
  priceChange: number | null; // null se simulatedPrice for null
  priceChangePercent: number | null; // null se simulatedPrice for null
  demandIndex: number;
  supplyIndex: number;
  demandSupplyRatio: number;
  adjustmentReason: string;
  computedAt: string;
  simulationConfidence: 'high' | 'medium' | 'low' | 'insufficient'; // Confiança na simulação
}

/**
 * Resultado de simulação de preço dinâmico por cidade
 */
export interface CityDynamicPricingResult {
  cityId: string;
  simulations: DynamicPricingSimulation[];
  totalProducts: number;
  productsWithPriceIncrease: number;
  productsWithPriceDecrease: number;
  totalPriceImpact: number; // Soma dos ajustes absolutos
  computedAt: string;
}

