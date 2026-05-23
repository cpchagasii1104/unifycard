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
  /** NULL quando canónico global. */
  tenantId: string | null;
  gtin: string; // Global Trade Item Number (único)
  name: string;
  brand?: string;
  images: string[];
  attributes: Record<string, unknown>; // JSONB
  categoryId: string;
  conceptId?: string;
  /** Resolução semântica vs `concepts` (SSOT); independente de fingerprint. */
  conceptResolutionStatus?: 'unresolved' | 'auto_suggested' | 'confirmed';
  type: 'INDUSTRIAL';
  /** Derivado de `isCanonicalProductOperationalReady` (sem persistência). */
  operationalReady: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Oferta de produto (merchant oferecendo produto canônico)
 */
export interface ProductOffer {
  id: string;
  tenantId: string;
  productId: string; // FK CanonicalProduct
  merchantId: string;
  priceCents: number;
  availableQuantity?: number;
  location: {
    regionId?: string;
    cityId?: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
}

/**
 * Resultado de busca unificado
 */
export interface CatalogSearchResult {
  canonicalProducts: CanonicalProduct[];
  localProducts: LocalProduct[];
  offers: ProductOffer[];
  totalCents: number;
}













