import type { OfferSearchResult } from './offer-index.types';
/**
 * Serviço de índice de ofertas
 * READ-ONLY: apenas busca e consulta, não cria ou altera ofertas
 * Não vende, apenas responde: quem vende isso perto daqui?
 */
declare class OfferIndexService {
    /**
     * Converte row do banco para OfferIndex
     * Nota: localização precisa ser obtida separadamente (merchant ou city)
     */
    private toOfferIndex;
    /**
     * Busca ofertas por produto e localização
     * READ-ONLY: apenas consulta, não cria ou altera
     */
    search(tenantId: string, filters: {
        productId: string;
        cityId?: string;
        radiusKm?: number;
        centerLat?: number;
        centerLng?: number;
    }): Promise<OfferSearchResult>;
    /**
     * Calcula distância em km entre dois pontos (Haversine)
     */
    private calculateDistance;
    /**
     * Converte graus para radianos
     */
    private toRad;
    /**
     * Busca ofertas por merchant
     */
    findByMerchant(tenantId: string, merchantId: string, options?: {
        productId?: string;
        limit?: number;
        offset?: number;
    }): Promise<OfferSearchResult>;
    /**
     * Log estruturado de busca (observação)
     */
    private logSearch;
}
export declare const offerIndexService: OfferIndexService;
export {};
//# sourceMappingURL=offer-index.service.d.ts.map