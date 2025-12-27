import type { ProductDemandSignal, CityProductDemandResult } from './product-demand.types';
/**
 * Serviço de sinal de demanda de produtos
 * READ-ONLY: apenas observa e mede, não executa decisões
 */
declare class ProductDemandService {
    private readonly TEMP_DEMAND_NORMALIZATION_THRESHOLD;
    private readonly TEMP_SUPPLY_NORMALIZATION_THRESHOLD;
    private readonly MIN_SAMPLE_SIZE_FOR_HIGH_CONFIDENCE;
    private readonly MIN_SAMPLE_SIZE_FOR_MEDIUM_CONFIDENCE;
    private readonly MIN_SAMPLE_SIZE_FOR_LOW_CONFIDENCE;
    private readonly MIN_DATA_WINDOW_DAYS_FOR_HIGH;
    private readonly MIN_DATA_WINDOW_DAYS_FOR_MEDIUM;
    private readonly MIN_DATA_WINDOW_DAYS_FOR_LOW;
    /**
     * Calcula sinais de demanda para todos os produtos de uma cidade
     */
    getCityDemandSignals(tenantId: string, cityId: string): Promise<CityProductDemandResult | null>;
    /**
     * Calcula sinal de demanda para um produto específico em uma cidade
     */
    getProductDemandSignal(tenantId: string, cityId: string, productId: string): Promise<ProductDemandSignal | null>;
    /**
     * Valida se cidade existe e verifica readiness (guardrail informativo)
     */
    private validateCity;
    /**
     * Obtém lista de produtos que têm ofertas na cidade
     */
    private getProductsWithOffers;
    /**
     * Calcula sinal de demanda para um produto
     */
    private calculateDemandSignal;
    /**
     * Obtém quantidade de buscas do produto nos últimos 7 dias
     * Lê do Decision Log (observações de busca)
     * Modo conservador: retorna 0 se não conseguir ler
     */
    private getSearchesLast7Days;
    /**
     * Log estruturado de cálculo de demanda por cidade
     */
    private logDemandCalculation;
    /**
     * Log estruturado de demanda por produto
     */
    private logProductDemand;
}
export declare const productDemandService: ProductDemandService;
export {};
//# sourceMappingURL=product-demand.service.d.ts.map