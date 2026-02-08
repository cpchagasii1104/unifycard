// src/core/catalog/canonical/canonical-product.types.ts
// Tipos para catálogo canônico de produtos - READ-ONLY

/**
 * Produto canônico
 * Identidade única do produto, independente de merchant ou cidade
 */
export interface CanonicalProduct {
  id: string;
  tenantId: string;
  gtin: string; // Global Trade Item Number (EAN/UPC)
  name: string;
  brand?: string;
  images: string[]; // URLs das imagens (único por produto)
  attributes: Record<string, unknown>; // JSONB: peso, volume, etc.
  categoryId?: string;
  type: 'INDUSTRIAL'; // Sempre INDUSTRIAL para produtos canônicos
  createdAt: string;
  updatedAt: string;
}

/**
 * Resultado de busca de produtos canônicos
 */
export interface CanonicalProductSearchResult {
  products: CanonicalProduct[];
  totalCents: number;
  query: string;
  filters?: {
    categoryId?: string;
    brand?: string;
  };
}













