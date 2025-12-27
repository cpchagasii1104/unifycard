import type { ProductOffer } from './catalog.types';
declare class OfferService {
    /**
     * Converte row do banco para ProductOffer
     */
    private toProductOffer;
    /**
     * Lista ofertas de um produto canônico
     */
    listOffersByProduct(tenantId: string, productId: string, options?: {
        regionId?: string;
        cityId?: string;
        activeOnly?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<ProductOffer[]>;
    /**
     * Busca oferta por ID
     */
    findById(tenantId: string, offerId: string): Promise<ProductOffer | null>;
}
export declare const offerService: OfferService;
export {};
//# sourceMappingURL=offer.service.d.ts.map