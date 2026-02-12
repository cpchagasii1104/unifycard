// backend/src/modules/marketplace/marketplace-categories.types.ts
// Marketplace Categories - Tipos
// 🔴 BLINDAGEM: Marketplace NÃO cria categorias próprias, consome CORE

import type { Category } from '@core/categories/categories.types';

/**
 * Tipo de categoria para Marketplace
 */
export type MarketplaceCategoryType = 'service' | 'product' | 'hybrid';

/**
 * Categoria do Marketplace (wrapper do Category canônico)
 */
export interface MarketplaceCategory extends Category {
  type?: MarketplaceCategoryType;
  path: string[]; // Path completo da hierarquia
  level: number;
}

/**
 * Importação parcial de categorias por Actor/Empresa
 */
export interface ActorCategoryImport {
  actorId: string;
  categoryIds: string[]; // IDs das categorias "ativadas"
  importedAt: Date;
  importedByActorId: string;
  metadata?: Record<string, any>;
}

/**
 * Input para importar categorias
 */
export interface ImportCategoriesInput {
  categoryIds: string[];
  metadata?: Record<string, any>;
}

/**
 * Domínios canônicos do Marketplace
 */
export type MarketplaceDomain = 'market' | 'services' | 'events' | 'real_estate' | 'vehicles' | 'jobs';

/**
 * Filtros para buscar categorias do Marketplace
 */
export interface MarketplaceCategoryFilters {
  type?: MarketplaceCategoryType;
  parentId?: string;
  scope?: string;
  includeInactive?: boolean;
  actorId?: string; // Filtrar apenas categorias importadas por este actor
  marketplaceDomain?: MarketplaceDomain; // Filtrar por domínio do marketplace
}

/**
 * Breadcrumb item
 */
export interface BreadcrumbItem {
  categoryId: string;
  name: string;
  slug: string;
  path: string;
}


