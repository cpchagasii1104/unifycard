// frontend/src/api/marketplace-categories.ts
// API client para Marketplace Categories
// 🔴 BLINDAGEM: Frontend apenas consome API, não calcula hierarquia

import type { MarketplaceDomain } from '@unificard/contracts';
import { apiFetchJson } from './client';

/**
 * Categoria do Marketplace
 */
export interface MarketplaceCategory {
  id: string;
  slug: string;
  name: string;
  description?: string;
  parentId?: string;
  scope: string;
  isActive: boolean;
  icon?: string;
  color?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  type?: 'service' | 'product' | 'hybrid';
  path: string[];
  level: number;
}

/**
 * Item do breadcrumb
 */
export interface BreadcrumbItem {
  categoryId: string;
  name: string;
  slug: string;
  path: string;
}

/**
 * Domínios canônicos do Marketplace.
 * 🔴 SSOT: vocabulário compartilhado em @unificard/contracts (vocabulary.ts, DECISION-0106) —
 * re-exporta, não redefine (fork fechado; frontend e backend consomem o MESMO símbolo).
 */
export type { MarketplaceDomain };

/**
 * Filtros para buscar categorias
 */
export interface MarketplaceCategoryFilters {
  type?: 'service' | 'product' | 'hybrid';
  actorId?: string;
  includeInactive?: boolean;
  domain?: MarketplaceDomain;
}

/**
 * Lista categorias raiz do Marketplace
 * BLOCKED_BY_FRONTEND_DEPENDENCY: Endpoint específico do marketplace mantido
 * Backend já usa adapter sobre categories core
 */
export async function getRootCategories(
  filters?: MarketplaceCategoryFilters
): Promise<MarketplaceCategory[]> {
  const queryParams = new URLSearchParams();
  if (filters?.type) queryParams.append('type', filters.type);
  if (filters?.actorId) queryParams.append('actorId', filters.actorId);
  if (filters?.includeInactive) queryParams.append('includeInactive', 'true');
  if (filters?.domain) queryParams.append('domain', filters.domain);
  // Default: 'market' para compatibilidade
  if (!filters?.domain) queryParams.append('domain', 'market');

  const queryString = queryParams.toString();
  const url = `/marketplace/categories/root?${queryString}`;
  
  const data = await apiFetchJson<{ categories: MarketplaceCategory[] }>(url);
  return data.categories;
}

/**
 * Busca categoria por ID
 * BLOCKED_BY_FRONTEND_DEPENDENCY: Endpoint específico do marketplace mantido
 * Backend já usa adapter sobre categories core
 */
export async function getCategoryById(categoryId: string): Promise<MarketplaceCategory> {
  const data = await apiFetchJson<{ category: MarketplaceCategory }>(
    `/marketplace/categories/${categoryId}`
  );
  return data.category;
}

/**
 * Lista branches (products/services) de um department
 * BLOCKED_BY_FRONTEND_DEPENDENCY: Endpoint específico do marketplace mantido
 * Backend já usa adapter sobre categories core
 */
export async function getDepartmentBranches(departmentId: string): Promise<MarketplaceCategory[]> {
  const data = await apiFetchJson<{ branches: MarketplaceCategory[] }>(
    `/marketplace/categories/${departmentId}/branches`
  );
  return data.branches;
}

/**
 * Lista categories de uma branch específica
 * BLOCKED_BY_FRONTEND_DEPENDENCY: Endpoint específico do marketplace mantido
 * Backend já usa adapter sobre categories core
 */
export async function getBranchCategories(
  branchId: string,
  filters?: MarketplaceCategoryFilters
): Promise<MarketplaceCategory[]> {
  const queryParams = new URLSearchParams();
  if (filters?.type) queryParams.append('type', filters.type);
  if (filters?.actorId) queryParams.append('actorId', filters.actorId);
  if (filters?.includeInactive) queryParams.append('includeInactive', 'true');

  const queryString = queryParams.toString();
  const url = queryString 
    ? `/marketplace/categories/branch/${branchId}/categories?${queryString}`
    : `/marketplace/categories/branch/${branchId}/categories`;
  
  const data = await apiFetchJson<{ categories: MarketplaceCategory[] }>(url);
  return data.categories;
}

/**
 * Lista categorias de oferta de uma store
 * BLOCKED_BY_FRONTEND_DEPENDENCY: Endpoint específico do marketplace mantido
 * Backend já usa adapter sobre categories core
 */
export async function getOfferCategoriesByStore(
  storeId: string
): Promise<MarketplaceCategory[]> {
  const url = `/marketplace/stores/${storeId}/offer-categories`;
  const data = await apiFetchJson<{ categories: MarketplaceCategory[] }>(url);
  return data.categories;
}

/**
 * Lista subcategorias de uma categoria
 */
export async function getCategoryChildren(
  categoryId: string,
  filters?: MarketplaceCategoryFilters
): Promise<MarketplaceCategory[]> {
  const queryParams = new URLSearchParams();
  if (filters?.type) queryParams.append('type', filters.type);
  if (filters?.actorId) queryParams.append('actorId', filters.actorId);
  if (filters?.includeInactive) queryParams.append('includeInactive', 'true');

  const data = await apiFetchJson<{ categories: MarketplaceCategory[] }>(
    `/marketplace/categories/${categoryId}/children?${queryParams.toString()}`
  );
  return data.categories;
}

/**
 * Busca categoria por path (ex: /bebidas/refrigerantes)
 * BLOCKED_BY_FRONTEND_DEPENDENCY: Endpoint específico do marketplace mantido
 * Backend já usa adapter sobre categories core
 */
export async function getCategoryByPath(path: string[]): Promise<MarketplaceCategory> {
  const pathStr = path.join('/');
  // Fastify usa * para capturar paths com múltiplos segmentos
  const data = await apiFetchJson<{ category: MarketplaceCategory }>(
    `/marketplace/categories/path/${pathStr}`
  );
  return data.category;
}

/**
 * Busca breadcrumb de uma categoria
 * BLOCKED_BY_FRONTEND_DEPENDENCY: Endpoint específico do marketplace mantido
 * Backend já usa adapter sobre categories core
 */
export async function getCategoryBreadcrumb(categoryId: string): Promise<BreadcrumbItem[]> {
  const data = await apiFetchJson<{ breadcrumb: BreadcrumbItem[] }>(
    `/marketplace/categories/${categoryId}/breadcrumb`
  );
  return data.breadcrumb;
}

/**
 * Importa categorias para um Actor
 * BLOCKED_BY_FRONTEND_DEPENDENCY: Endpoint específico do marketplace mantido
 * Backend já usa adapter sobre categories core
 */
export async function importCategories(
  actorId: string,
  categoryIds: string[],
  metadata?: Record<string, any>
): Promise<void> {
  await apiFetchJson('/marketplace/categories/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actorId, categoryIds, metadata }),
  });
}

/**
 * Lista categorias importadas por um Actor
 * BLOCKED_BY_FRONTEND_DEPENDENCY: Endpoint específico do marketplace mantido
 * Backend já usa adapter sobre categories core
 */
export async function getImportedCategories(actorId: string): Promise<MarketplaceCategory[]> {
  const data = await apiFetchJson<{ categories: MarketplaceCategory[] }>(
    `/marketplace/categories/imported/${actorId}`
  );
  return data.categories;
}

