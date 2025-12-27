import type { CanonicalProduct, CanonicalProductSearchResult } from './canonical-product.types';
/**
 * Serviço de produtos canônicos
 * READ-ONLY: apenas busca e consulta, não cria ou altera produtos
 */
declare class CanonicalProductService {
    /**
     * Converte row do banco para CanonicalProduct
     */
    private toCanonicalProduct;
    /**
     * Busca produtos canônicos
     * READ-ONLY: apenas consulta, não cria ou altera
     */
    search(tenantId: string, query: string, options?: {
        categoryId?: string;
        brand?: string;
        limit?: number;
        offset?: number;
    }): Promise<CanonicalProductSearchResult>;
    /**
     * Busca produto canônico por GTIN
     */
    findByGTIN(tenantId: string, gtin: string): Promise<CanonicalProduct | null>;
    /**
     * Busca produto canônico por ID
     */
    findById(tenantId: string, productId: string): Promise<CanonicalProduct | null>;
    /**
     * Busca produtos por categoria
     */
    findByCategory(tenantId: string, categoryId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<CanonicalProductSearchResult>;
    /**
     * Log estruturado de busca (observação)
     */
    private logSearch;
}
export declare const canonicalProductService: CanonicalProductService;
export {};
//# sourceMappingURL=canonical-product.service.d.ts.map