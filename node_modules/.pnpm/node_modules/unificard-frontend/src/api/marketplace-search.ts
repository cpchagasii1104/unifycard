// frontend/src/api/marketplace-search.ts
// API client para Marketplace Search
// 🔴 BLINDAGEM: Frontend apenas consome API, não calcula ranking

import { apiFetchJson } from './client';

/**
 * Status de disponibilidade
 */
export type AvailabilityStatus = 'available' | 'partial' | 'unavailable' | 'unknown';

/**
 * Status de compatibilidade
 */
export type CompatibilityStatus = 'OK' | 'WARNING' | 'BLOCKED';

/**
 * Resultado de busca do Marketplace
 */
export interface MarketplaceSearchResult {
  serviceId: string;
  actorId: string;
  name: string;
  slug: string;
  description?: string;
  categoryPath: string[];
  categoryId: string;
  availabilityStatus: AvailabilityStatus;
  compatibilityStatus: CompatibilityStatus;
  trustScore: number | null;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED' | null;
  capacityRange: {
    min: number | null;
    max: number | null;
  };
  priceRange: {
    min: number | null;
    max: number | null;
    currency: string;
  };
  location?: {
    cityId: string | null;
    stateId: string | null;
    countryId: string | null;
  };
  rankingReasons: string[];
  rankingScore: number;
  metadata: Record<string, any>;
}

/**
 * Filtros de busca
 */
export interface MarketplaceSearchFilters {
  categoryPath: string[];
  dateRange?: {
    start: string; // ISO string
    end: string; // ISO string
  };
  location?: {
    cityId?: string;
    stateId?: string;
    countryId?: string;
  };
  capacity?: {
    min?: number;
    max?: number;
  };
  priceRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  availability?: AvailabilityStatus[];
  trustLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
  actorType?: 'user' | 'company' | 'group';
  limit?: number;
  offset?: number;
}

/**
 * Resposta da busca
 */
export interface MarketplaceSearchResponse {
  results: MarketplaceSearchResult[];
  total: number;
  filters: MarketplaceSearchFilters;
  rankingExplanation: string;
}

/**
 * Busca serviços no Marketplace
 */
export async function searchMarketplace(
  filters: MarketplaceSearchFilters
): Promise<MarketplaceSearchResponse> {
  const queryParams = new URLSearchParams();
  
  // categoryPath obrigatório
  queryParams.append('categoryPath', filters.categoryPath.join('/'));
  
  if (filters.dateRange) {
    queryParams.append('startDate', filters.dateRange.start);
    queryParams.append('endDate', filters.dateRange.end);
  }
  
  if (filters.location) {
    if (filters.location.cityId) queryParams.append('cityId', filters.location.cityId);
    if (filters.location.stateId) queryParams.append('stateId', filters.location.stateId);
    if (filters.location.countryId) queryParams.append('countryId', filters.location.countryId);
  }
  
  if (filters.capacity) {
    if (filters.capacity.min !== undefined) queryParams.append('capacityMin', filters.capacity.min.toString());
    if (filters.capacity.max !== undefined) queryParams.append('capacityMax', filters.capacity.max.toString());
  }
  
  if (filters.priceRange) {
    if (filters.priceRange.min !== undefined) queryParams.append('priceMin', filters.priceRange.min.toString());
    if (filters.priceRange.max !== undefined) queryParams.append('priceMax', filters.priceRange.max.toString());
    if (filters.priceRange.currency) queryParams.append('currency', filters.priceRange.currency);
  }
  
  if (filters.availability && filters.availability.length > 0) {
    queryParams.append('availability', filters.availability.join(','));
  }
  
  if (filters.trustLevel) queryParams.append('trustLevel', filters.trustLevel);
  if (filters.actorType) queryParams.append('actorType', filters.actorType);
  if (filters.limit) queryParams.append('limit', filters.limit.toString());
  if (filters.offset) queryParams.append('offset', filters.offset.toString());

  const data = await apiFetchJson<MarketplaceSearchResponse>(
    `/marketplace/search?${queryParams.toString()}`
  );
  return data;
}




