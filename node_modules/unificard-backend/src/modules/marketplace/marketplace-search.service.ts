// backend/src/modules/marketplace/marketplace-search.service.ts
// Marketplace Search Service - Ranking Determinístico
// 🔴 BLINDAGEM: Ranking explicável, determinístico e auditável

import type {
  MarketplaceSearchFilters,
  MarketplaceSearchResult,
  MarketplaceSearchResponse,
  AvailabilityStatus,
  CompatibilityStatus,
} from './marketplace-search.types';

class MarketplaceSearchService {
  /**
   * Busca serviços no Marketplace com ranking determinístico
   * 🔴 BLINDAGEM: Ranking sempre explicável e reproduzível
   */
  async search(
    tenantId: string,
    filters: MarketplaceSearchFilters
  ): Promise<MarketplaceSearchResponse> {
    // Validar filtros obrigatórios
    if (!filters.categoryPath || filters.categoryPath.length === 0) {
      throw new Error('categoryPath é obrigatório');
    }

    // 1. Buscar categoria raiz do path
    const { marketplaceCategoriesService } = await import('./marketplace-categories.service');
    const rootCategory = await marketplaceCategoriesService.getCategoryByPath(
      tenantId,
      [filters.categoryPath[0]]
    );

    if (!rootCategory) {
      throw new Error('Categoria não encontrada');
    }

    // 2. Buscar todas as categorias descendentes (incluindo a atual)
    const allCategoryIds = await this.getCategoryTreeIds(tenantId, rootCategory.id);

    // 3. Buscar serviços nessas categorias
    const { servicesRepository } = await import('../services/services.repository');
    // Buscar serviços de todas as categorias do tree
    const allServices: any[] = [];
    for (const categoryId of allCategoryIds) {
      const services = await servicesRepository.discoverServices(tenantId, {
        categoryId,
        limit: 1000,
      });
      allServices.push(...services);
    }
    
    // Remover duplicatas por serviceId
    const uniqueServices = Array.from(
      new Map(allServices.map((s) => [s.serviceId, s])).values()
    );

    // 4. Filtrar e rankear serviços
    const results: MarketplaceSearchResult[] = [];

    for (const service of uniqueServices) {
      // Construir resultado
      const result = await this.buildSearchResult(
        tenantId,
        service.serviceId,
        service,
        filters
      );

      if (result) {
        results.push(result);
      }
    }

    // 5. Aplicar filtros adicionais
    let filtered = this.applyFilters(results, filters);

    // 6. Ordenar por ranking determinístico
    filtered.sort((a, b) => {
      // Ordenação determinística (ordem de prioridade):
      // 1. Disponibilidade real
      const availOrder = this.getAvailabilityOrder(a.availabilityStatus) -
        this.getAvailabilityOrder(b.availabilityStatus);
      if (availOrder !== 0) return availOrder;

      // 2. Compatibilidade técnica
      const compatOrder = this.getCompatibilityOrder(a.compatibilityStatus) -
        this.getCompatibilityOrder(b.compatibilityStatus);
      if (compatOrder !== 0) return compatOrder;

      // 3. Trust Score (decrescente)
      const trustA = a.trustScore || 0;
      const trustB = b.trustScore || 0;
      if (trustB !== trustA) return trustB - trustA;

      // 4. Capacidade compatível (maior capacidade primeiro se dentro do range)
      const capacityOrder = this.compareCapacity(a, b, filters.capacity);
      if (capacityOrder !== 0) return capacityOrder;

      // 5. Ordem de criação (mais antigos primeiro)
      return a.metadata.createdAt?.localeCompare(b.metadata.createdAt || '') || 0;
    });

    // 7. Aplicar paginação
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      results: paginated,
      total: filtered.length,
      filters,
      rankingExplanation: this.generateRankingExplanation(),
    };
  }

  /**
   * Busca IDs de todas as categorias descendentes
   */
  private async getCategoryTreeIds(tenantId: string, rootCategoryId: string): Promise<string[]> {
    const { categoriesService } = await import('../../core/categories/categories.service');
    const categoryIds: string[] = [rootCategoryId];

    // Buscar filhos recursivamente usando o service canônico
    const children = await categoriesService.getChildren(rootCategoryId);
    for (const child of children) {
      const childIds = await this.getCategoryTreeIds(tenantId, child.categoryId);
      categoryIds.push(...childIds);
    }

    return categoryIds;
  }

  /**
   * Constrói resultado de busca para um serviço
   */
  private async buildSearchResult(
    tenantId: string,
    serviceId: string,
    service: any,
    filters: MarketplaceSearchFilters
  ): Promise<MarketplaceSearchResult | null> {
    // Buscar informações adicionais
    const availabilityStatus = await this.checkAvailability(
      tenantId,
      serviceId,
      filters.dateRange
    );

    const compatibilityStatus = await this.checkCompatibility(
      tenantId,
      serviceId,
      filters
    );

    const trustInfo = await this.getTrustInfo(tenantId, service.actorId);

    const capacityRange = await this.getCapacityRange(tenantId, serviceId);

    const priceRange = this.getPriceRange(service);

    const categoryPath = await this.getCategoryPath(tenantId, service.categoryId || '');

    const rankingReasons = this.generateRankingReasons(
      availabilityStatus,
      compatibilityStatus,
      trustInfo.trustScore,
      capacityRange,
      filters
    );

    const rankingScore = this.calculateRankingScore(
      availabilityStatus,
      compatibilityStatus,
      trustInfo.trustScore,
      capacityRange
    );

    return {
      serviceId: service.serviceId,
      actorId: service.actorId,
      name: service.name,
      slug: service.slug,
      description: service.description || undefined,
      categoryPath,
      categoryId: service.categoryId || '',
      availabilityStatus,
      compatibilityStatus,
      trustScore: trustInfo.trustScore,
      riskLevel: trustInfo.riskLevel,
      capacityRange,
      priceRange,
      location: {
        cityId: service.cityId || null,
        stateId: service.stateId || null,
        countryId: service.countryId || null,
      },
      rankingReasons,
      rankingScore,
      metadata: {
        ...service.metadata,
        createdAt: service.createdAt?.toISOString(),
      },
    };
  }

  /**
   * Verifica disponibilidade do serviço
   */
  private async checkAvailability(
    tenantId: string,
    serviceId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<AvailabilityStatus> {
    if (!dateRange) {
      return 'unknown';
    }

    try {
      const { serviceAvailabilityRepository } = await import(
        '../services/service-availability.repository'
      );
      const availabilities = await serviceAvailabilityRepository.findByService(tenantId, serviceId);

      // Verificar se há disponibilidade no período
      const hasAvailability = availabilities.some((avail) => {
        const availStart = new Date(avail.startTime);
        const availEnd = new Date(avail.endTime);
        return availStart <= dateRange.end && availEnd >= dateRange.start;
      });

      if (hasAvailability) {
        return 'available';
      }

      return 'unavailable';
    } catch (err) {
      return 'unknown';
    }
  }

  /**
   * Verifica compatibilidade técnica
   */
  private async checkCompatibility(
    tenantId: string,
    serviceId: string,
    filters: MarketplaceSearchFilters
  ): Promise<CompatibilityStatus> {
    // Por enquanto, retornar OK
    // TODO: Integrar com Compatibility Engine quando necessário
    return 'OK';
  }

  /**
   * Busca informações de trust
   */
  private async getTrustInfo(
    tenantId: string,
    actorId: string
  ): Promise<{ trustScore: number | null; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED' | null }> {
    try {
      const { trustRepository } = await import('../trust/trust.repository');
      const profile = await trustRepository.findByActor(tenantId, actorId);
      if (profile) {
        return {
          trustScore: profile.currentScore,
          riskLevel: profile.riskLevel,
        };
      }
    } catch (err) {
      // Ignorar erro
    }

    return { trustScore: null, riskLevel: null };
  }

  /**
   * Busca range de capacidade
   */
  private async getCapacityRange(
    tenantId: string,
    serviceId: string
  ): Promise<{ min: number | null; max: number | null }> {
    try {
      const { servicesRepository } = await import('../services/services.repository');
      const service = await servicesRepository.findById(tenantId, serviceId);
      if (service?.metadata?.capacity) {
        return {
          min: service.metadata.capacity.min || null,
          max: service.metadata.capacity.max || null,
        };
      }
    } catch (err) {
      // Ignorar erro
    }

    return { min: null, max: null };
  }

  /**
   * Extrai range de preço do serviço
   */
  private getPriceRange(service: any): {
    min: number | null;
    max: number | null;
    currency: string;
  } {
    return {
      min: service.priceCents || null,
      max: service.priceCents || null,
      currency: service.currency || 'BRL',
    };
  }

  /**
   * Busca path completo da categoria
   */
  private async getCategoryPath(tenantId: string, categoryId: string): Promise<string[]> {
    if (!categoryId) return [];

    try {
      const { marketplaceCategoriesService } = await import('./marketplace-categories.service');
      const category = await marketplaceCategoriesService.getCategoryById(tenantId, categoryId);
      return category?.path || [];
    } catch (err) {
      return [];
    }
  }

  /**
   * Gera explicações textuais do ranking
   */
  private generateRankingReasons(
    availabilityStatus: AvailabilityStatus,
    compatibilityStatus: CompatibilityStatus,
    trustScore: number | null,
    capacityRange: { min: number | null; max: number | null },
    filters: MarketplaceSearchFilters
  ): string[] {
    const reasons: string[] = [];

    if (availabilityStatus === 'available') {
      reasons.push('Disponível no período solicitado');
    } else if (availabilityStatus === 'unavailable') {
      reasons.push('Indisponível no período solicitado');
    }

    if (compatibilityStatus === 'OK') {
      reasons.push('Compatibilidade técnica confirmada');
    } else if (compatibilityStatus === 'WARNING') {
      reasons.push('Compatibilidade técnica com ressalvas');
    } else if (compatibilityStatus === 'BLOCKED') {
      reasons.push('Incompatibilidade técnica detectada');
    }

    if (trustScore !== null) {
      if (trustScore >= 75) {
        reasons.push(`Alto nível de confiança (${trustScore}/100)`);
      } else if (trustScore >= 50) {
        reasons.push(`Nível médio de confiança (${trustScore}/100)`);
      } else {
        reasons.push(`Nível baixo de confiança (${trustScore}/100)`);
      }
    }

    if (capacityRange.min !== null || capacityRange.max !== null) {
      const min = capacityRange.min || 0;
      const max = capacityRange.max || '∞';
      reasons.push(`Capacidade: ${min} - ${max} pessoas`);
    }

    return reasons;
  }

  /**
   * Calcula score numérico para ordenação
   */
  private calculateRankingScore(
    availabilityStatus: AvailabilityStatus,
    compatibilityStatus: CompatibilityStatus,
    trustScore: number | null,
    capacityRange: { min: number | null; max: number | null }
  ): number {
    let score = 0;

    // Disponibilidade (peso: 1000)
    if (availabilityStatus === 'available') score += 1000;
    else if (availabilityStatus === 'partial') score += 500;

    // Compatibilidade (peso: 100)
    if (compatibilityStatus === 'OK') score += 100;
    else if (compatibilityStatus === 'WARNING') score += 50;

    // Trust Score (peso: 1)
    if (trustScore !== null) score += trustScore;

    return score;
  }

  /**
   * Aplica filtros adicionais
   */
  private applyFilters(
    results: MarketplaceSearchResult[],
    filters: MarketplaceSearchFilters
  ): MarketplaceSearchResult[] {
    let filtered = results;

    // Filtro de localização
    if (filters.location) {
      filtered = filtered.filter((r) => {
        if (filters.location?.cityId && r.location?.cityId !== filters.location.cityId) {
          return false;
        }
        if (filters.location?.stateId && r.location?.stateId !== filters.location.stateId) {
          return false;
        }
        if (filters.location?.countryId && r.location?.countryId !== filters.location.countryId) {
          return false;
        }
        return true;
      });
    }

    // Filtro de capacidade
    if (filters.capacity) {
      filtered = filtered.filter((r) => {
        if (filters.capacity?.min && r.capacityRange.max !== null && r.capacityRange.max < filters.capacity.min) {
          return false;
        }
        if (filters.capacity?.max && r.capacityRange.min !== null && r.capacityRange.min > filters.capacity.max) {
          return false;
        }
        return true;
      });
    }

    // Filtro de preço
    if (filters.priceRange) {
      filtered = filtered.filter((r) => {
        if (filters.priceRange?.min && r.priceRange.max !== null && r.priceRange.max < filters.priceRange.min) {
          return false;
        }
        if (filters.priceRange?.max && r.priceRange.min !== null && r.priceRange.min > filters.priceRange.max) {
          return false;
        }
        return true;
      });
    }

    // Filtro de disponibilidade
    if (filters.availability && filters.availability.length > 0) {
      filtered = filtered.filter((r) => filters.availability!.includes(r.availabilityStatus));
    }

    // Filtro de trust level
    if (filters.trustLevel) {
      filtered = filtered.filter((r) => {
        if (!r.riskLevel) return false;
        const levelOrder = { LOW: 0, MEDIUM: 1, HIGH: 2, BLOCKED: 3 };
        const filterOrder = levelOrder[filters.trustLevel!];
        const resultOrder = levelOrder[r.riskLevel];
        return resultOrder <= filterOrder;
      });
    }

    return filtered;
  }

  /**
   * Ordem de disponibilidade (menor = melhor)
   */
  private getAvailabilityOrder(status: AvailabilityStatus): number {
    const order: Record<AvailabilityStatus, number> = {
      available: 0,
      partial: 1,
      unknown: 2,
      unavailable: 3,
    };
    return order[status];
  }

  /**
   * Ordem de compatibilidade (menor = melhor)
   */
  private getCompatibilityOrder(status: CompatibilityStatus): number {
    const order: Record<CompatibilityStatus, number> = {
      OK: 0,
      WARNING: 1,
      BLOCKED: 2,
    };
    return order[status];
  }

  /**
   * Compara capacidade
   */
  private compareCapacity(
    a: MarketplaceSearchResult,
    b: MarketplaceSearchResult,
    capacityFilter?: { min?: number; max?: number }
  ): number {
    if (!capacityFilter) return 0;

    // Priorizar serviços com capacidade dentro do range
    const aInRange = this.isCapacityInRange(a.capacityRange, capacityFilter);
    const bInRange = this.isCapacityInRange(b.capacityRange, capacityFilter);

    if (aInRange && !bInRange) return -1;
    if (!aInRange && bInRange) return 1;

    // Se ambos estão no range, priorizar maior capacidade
    if (aInRange && bInRange) {
      const aMax = a.capacityRange.max || 0;
      const bMax = b.capacityRange.max || 0;
      return bMax - aMax;
    }

    return 0;
  }

  /**
   * Verifica se capacidade está no range
   */
  private isCapacityInRange(
    capacityRange: { min: number | null; max: number | null },
    filter: { min?: number; max?: number }
  ): boolean {
    if (capacityRange.min === null && capacityRange.max === null) return false;

    if (filter.min && capacityRange.max !== null && capacityRange.max < filter.min) {
      return false;
    }
    if (filter.max && capacityRange.min !== null && capacityRange.min > filter.max) {
      return false;
    }

    return true;
  }

  /**
   * Gera explicação geral do ranking
   */
  private generateRankingExplanation(): string {
    return `Resultados ordenados por: (1) Disponibilidade no período, (2) Compatibilidade técnica, (3) Trust Score, (4) Capacidade compatível, (5) Data de criação. Ranking determinístico e reproduzível.`;
  }
}

export const marketplaceSearchService = new MarketplaceSearchService();

