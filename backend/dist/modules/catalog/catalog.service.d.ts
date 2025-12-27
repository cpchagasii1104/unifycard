import type { CanonicalProduct, CatalogSearchResult } from './catalog.types';
declare class CatalogService {
    /**
     * Converte row do banco para CanonicalProduct
     */
    private toCanonicalProduct;
    /**
     * Converte row do banco para LocalProduct
     */
    private toLocalProduct;
    /**
     * Busca produto canônico por GTIN
     */
    findByGTIN(tenantId: string, gtin: string): Promise<CanonicalProduct | null>;
    /**
     * Busca produto canônico por ID
     */
    findById(tenantId: string, productId: string): Promise<CanonicalProduct | null>;
    /**
     * Busca produtos no catálogo (canônicos + locais)
     */
    search(tenantId: string, query: string, options?: {
        regionId?: string;
        cityId?: string;
        categoryId?: string;
        type?: 'INDUSTRIAL' | 'LOCAL' | 'ALL';
        limit?: number;
        offset?: number;
    }): Promise<CatalogSearchResult>;
}
export declare const catalogService: CatalogService;
export {};
//# sourceMappingURL=catalog.service.d.ts.map