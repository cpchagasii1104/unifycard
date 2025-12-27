/**
 * Produto canônico
 * Identidade única do produto, independente de merchant ou cidade
 */
export interface CanonicalProduct {
    id: string;
    tenantId: string;
    gtin: string;
    name: string;
    brand?: string;
    images: string[];
    attributes: Record<string, unknown>;
    categoryId?: string;
    type: 'INDUSTRIAL';
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Resultado de busca de produtos canônicos
 */
export interface CanonicalProductSearchResult {
    products: CanonicalProduct[];
    total: number;
    query: string;
    filters?: {
        categoryId?: string;
        brand?: string;
    };
}
//# sourceMappingURL=canonical-product.types.d.ts.map