/**
 * Simulação de preço dinâmico
 * Apenas observa e simula, não executa mudanças
 */
export interface DynamicPricingSimulation {
    productId: string;
    cityId: string;
    currentPrice: number;
    simulatedPrice: number | null;
    priceChange: number | null;
    priceChangePercent: number | null;
    demandIndex: number;
    supplyIndex: number;
    demandSupplyRatio: number;
    adjustmentReason: string;
    computedAt: string;
    simulationConfidence: 'high' | 'medium' | 'low' | 'insufficient';
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
    totalPriceImpact: number;
    computedAt: string;
}
//# sourceMappingURL=dynamic-pricing.types.d.ts.map