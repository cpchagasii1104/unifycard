// backend/src/modules/marketplace/marketplace-search.types.ts
// Marketplace Search - Tipos
// 🔴 BLINDAGEM: Ranking determinístico, explicável e auditável

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
  riskLevel: 'low' | 'medium' | 'high' | 'critical' | null;
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
  rankingReasons: string[]; // Explicações textuais do ranking
  rankingScore: number; // Score numérico para ordenação
  metadata: Record<string, any>;
}

/**
 * Filtros de busca
 */
export interface MarketplaceSearchFilters {
  categoryPath: string[]; // Obrigatório
  dateRange?: {
    start: Date;
    end: Date;
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
  trustLevel?: 'low' | 'medium' | 'high' | 'critical';
  actorType?: 'user' | 'company' | 'group';
  limit?: number;
  offset?: number;
}

/**
 * Resposta da busca
 */
export interface MarketplaceSearchResponse {
  results: MarketplaceSearchResult[];
  totalCents: number;
  filters: MarketplaceSearchFilters;
  rankingExplanation: string; // Explicação geral do ranking
}





