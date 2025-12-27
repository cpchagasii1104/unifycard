// src/modules/catalog/catalog.types.ts
// Tipos para catálogo canônico híbrido

/**
 * Tipo de produto
 */
export type ProductType = 'INDUSTRIAL' | 'LOCAL';

/**
 * Produto canônico (industrial com GTIN)
 */
export interface CanonicalProduct {
  id: string;
  tenantId: string;
  gtin: string; // Global Trade Item Number (único)
  name: string;
  brand?: string;
  images: string[];
  attributes: Record<string, unknown>; // JSONB
  categoryId: string;
  type: 'INDUSTRIAL';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Oferta de produto (merchant oferecendo produto canônico)
 */
export interface ProductOffer {
  id: string;
  tenantId: string;
  productId: string; // FK CanonicalProduct
  merchantId: string;
  price: number;
  stock?: number;
  location: {
    regionId?: string;
    cityId?: string;
  };
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Produto local (sem GTIN, criado por merchant)
 */
export interface LocalProduct {
  id: string;
  tenantId: string;
  merchantId: string;
  name: string;
  description?: string;
  images: string[];
  attributes: Record<string, unknown>; // JSONB
  categoryId: string;
  type: 'LOCAL';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resultado de busca unificado
 */
export interface CatalogSearchResult {
  canonicalProducts: CanonicalProduct[];
  localProducts: LocalProduct[];
  offers: ProductOffer[];
  total: number;
}



