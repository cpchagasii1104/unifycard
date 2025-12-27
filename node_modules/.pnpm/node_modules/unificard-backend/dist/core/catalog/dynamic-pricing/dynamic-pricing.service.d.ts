import type { DynamicPricingSimulation, CityDynamicPricingResult } from './dynamic-pricing.types';
/**
 * Serviço de simulação de preço dinâmico
 * READ-ONLY: apenas simula, não executa mudanças de preço
 */
declare class DynamicPricingService {
    /**
     * Simula preços dinâmicos para todos os produtos de uma cidade
     */
    simulateCityDynamicPricing(tenantId: string, cityId: string): Promise<CityDynamicPricingResult | null>;
    /**
     * Simula preço dinâmico para um produto específico
     */
    simulateProductPricing(tenantId: string, cityId: string, productId: string, demandSignal?: {
        demandIndex: number;
        supplyIndex: number;
        demandSupplyRatio: number;
        searchesLast7Days: number;
        offersCount: number;
        confidence?: 'high' | 'medium' | 'low' | 'insufficient';
        sampleSize?: number;
        dataWindowDays?: number;
        reason?: string;
    }): Promise<DynamicPricingSimulation | null>;
    /**
     * Obtém preço médio atual das ofertas do produto na cidade
     */
    private getAveragePrice;
    /**
     * Calcula preço dinâmico simulado
     * Baseado em demanda vs oferta
     */
    private calculateDynamicPrice;
    /**
     * Determina motivo do ajuste de preço
     */
    private getAdjustmentReason;
    /**
     * Log estruturado de simulação de preço por cidade
     */
    private logPricingSimulation;
    /**
     * Log estruturado de preço por produto
     */
    private logProductPricing;
}
export declare const dynamicPricingService: DynamicPricingService;
export {};
//# sourceMappingURL=dynamic-pricing.service.d.ts.map