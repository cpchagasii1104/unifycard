// src/core/catalog/canonical/canonical-product.types.ts
// Tipos de domínio (camelCase — §5.2). Shapes PG: `canonical-product-db.types.ts`.

import type { ConceptResolutionStatus } from './canonical-concept.types';

/**
 * Produto canônico
 * Identidade única do produto, independente de merchant ou cidade
 */
export interface CanonicalProduct {
  id: string;
  /** NULL quando canónico global. */
  tenantId: string | null;
  gtin: string; // Global Trade Item Number (EAN/UPC)
  name: string;
  brand?: string;
  images: string[]; // URLs das imagens (único por produto)
  attributes: Record<string, unknown>; // JSONB: peso, volume, etc.
  categoryId?: string;
  /** FK opcional para `concepts` (SSOT semântico). */
  conceptId?: string;
  /** Estado da resolução semântica (independente de fingerprint_v1). */
  conceptResolutionStatus?: ConceptResolutionStatus;
  type: 'INDUSTRIAL'; // Sempre INDUSTRIAL para produtos canônicos
  /** Derivado de `isCanonicalProductOperationalReady` (sem persistência). */
  operationalReady: boolean;
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













