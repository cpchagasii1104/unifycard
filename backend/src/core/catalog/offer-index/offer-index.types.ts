// src/core/catalog/offer-index/offer-index.types.ts
// Tipos para índice de ofertas - READ-ONLY

/**
 * Índice de oferta
 * Mapeia QUEM vende cada produto e ONDE
 */
export interface OfferIndex {
  id: string;
  tenantId: string;
  productId: string; // FK CanonicalProduct
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
  createdAt: string;
  updatedAt: string;
}

/**
 * Resultado de busca de ofertas
 */
export interface OfferSearchResult {
  offers: OfferIndex[];
  totalCents: number;
  filters: {
    productId?: string;
    cityId?: string;
    radiusKm?: number;
    centerLat?: number;
    centerLng?: number;
  };
}













