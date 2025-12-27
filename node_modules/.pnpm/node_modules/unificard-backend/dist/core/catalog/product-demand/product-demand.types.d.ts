/**
 * Sinal de demanda de produto por cidade
 * Observa demanda vs oferta, sem executar decisões
 */
export interface ProductDemandSignal {
    cityId: string;
    productId: string;
    demandIndex: number;
    supplyIndex: number;
    demandSupplyRatio: number;
    searchesLast7Days: number;
    offersCount: number;
    computedAt: string;
    confidence: 'high' | 'medium' | 'low' | 'insufficient';
    sampleSize: number;
    dataWindowDays: number;
    reason?: string;
}
/**
 * Resultado de demanda por cidade
 */
export interface CityProductDemandResult {
    cityId: string;
    signals: ProductDemandSignal[];
    totalProducts: number;
    highDemandProducts: number;
    lowSupplyProducts: number;
    computedAt: string;
}
//# sourceMappingURL=product-demand.types.d.ts.map