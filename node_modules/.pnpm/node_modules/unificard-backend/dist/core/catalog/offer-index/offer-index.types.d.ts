/**
 * Índice de oferta
 * Mapeia QUEM vende cada produto e ONDE
 */
export interface OfferIndex {
    id: string;
    tenantId: string;
    productId: string;
    merchantId: string;
    cityId?: string;
    regionId?: string;
    location: {
        latitude: number;
        longitude: number;
    };
    availability: {
        inStock: boolean;
        stockCount?: number;
    };
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Resultado de busca de ofertas
 */
export interface OfferSearchResult {
    offers: OfferIndex[];
    total: number;
    filters: {
        productId?: string;
        cityId?: string;
        radiusKm?: number;
        centerLat?: number;
        centerLng?: number;
    };
}
//# sourceMappingURL=offer-index.types.d.ts.map