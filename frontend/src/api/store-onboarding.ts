// frontend/src/api/store-onboarding.ts
// API client para Store Onboarding
// 🔴 BLINDAGEM: Frontend apenas consome API, não cria categorias ou produtos

import { apiFetchJson } from './client';

/**
 * Input para criar onboarding de loja
 */
export interface StoreOnboardingInput {
  actorId: string;
  departmentCategoryId: string;
  selectedCategoryIds: string[];
  hasOwnProducts: boolean;
  defaultCostPrice?: number;
  defaultSalePrice?: number;
  defaultStock?: number;
  metadata?: Record<string, any>;
}

/**
 * Resultado do onboarding
 */
export interface StoreOnboardingResult {
  storeId: string;
  departmentCategoryId: string;
  selectedCategoryIds: string[];
  hasOwnProducts: boolean;
  importedProductsCount: number;
  createdOffersCount: number;
  categoriesImported: boolean;
  metadata?: Record<string, any>;
}

/**
 * Produto do catálogo disponível para importação
 */
export interface AvailableCatalogProduct {
  productId: string;
  gtin: string;
  name: string;
  brand?: string;
  categoryId: string;
  categoryName: string;
  images: string[];
  attributes: Record<string, any>;
}

/**
 * Estatísticas de produtos disponíveis por categoria
 */
export interface CategoryProductStats {
  categoryId: string;
  categoryName: string;
  availableProductsCount: number;
}

/**
 * Cria onboarding de loja
 */
export async function createStoreOnboarding(
  input: StoreOnboardingInput
): Promise<StoreOnboardingResult> {
  const data = await apiFetchJson<{ result: StoreOnboardingResult }>(
    '/marketplace/store-onboarding',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  );
  return data.result;
}

/**
 * Lista produtos do catálogo disponíveis para importação
 */
export async function listAvailableCatalogProducts(
  categoryIds: string[]
): Promise<AvailableCatalogProduct[]> {
  const data = await apiFetchJson<{ products: AvailableCatalogProduct[] }>(
    `/marketplace/store-onboarding/available-products?categoryIds=${categoryIds.join(',')}`
  );
  return data.products;
}

/**
 * Retorna estatísticas de produtos disponíveis por categoria
 */
export async function getCategoryProductStats(
  categoryIds: string[]
): Promise<CategoryProductStats[]> {
  const data = await apiFetchJson<{ stats: CategoryProductStats[] }>(
    `/marketplace/store-onboarding/category-stats?categoryIds=${categoryIds.join(',')}`
  );
  return data.stats;
}




