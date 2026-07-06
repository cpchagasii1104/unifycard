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
 * Campos opcionais (metadata, icon, color, isActive) alinham ao domínio quando expostos pela API.
 */
export interface MarketplaceCategory extends Category {
  /** Alias para categoryId em respostas de API */
  id?: string;
  type?: MarketplaceCategoryType;
  path: string[]; // Path completo da hierarquia
  level: number;
  metadata?: Record<string, unknown>;
  icon?: string;
  color?: string;
  isActive?: boolean;
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
 * Domínios canônicos do Marketplace.
 * 🔴 SSOT: o vocabulário vive em @core/marketplace-domain (DECISION-0106, home governado) — este arquivo
 * IMPORTA + RE-EXPORTA, não redefine (evita vocabulário paralelo; guard audit-governed-vocabulary-manifest).
 */
import type { MarketplaceDomain } from '@core/marketplace-domain/marketplace-domain-n0-mapping';
export type { MarketplaceDomain };

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


