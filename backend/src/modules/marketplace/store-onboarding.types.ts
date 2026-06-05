// backend/src/modules/marketplace/store-onboarding.types.ts
// Store Onboarding - Tipos
// 🔴 BLINDAGEM: Loja apenas seleciona recortes da taxonomia, não cria categorias

/** Linhas opcionais a garantir no catálogo canónico (dedupe via pipeline de criação). */
export interface StoreOnboardingSeedCanonicalLine {
  name: string;
  brand?: string;
  gtin?: string;
  /** Deve pertencer ao recorte do onboarding (department + selected). */
  categoryId: string;
}

/** Input para criar onboarding de loja */
export interface StoreOnboardingInput {
  actorId: string; // ID da empresa/loja
  /**
   * PONTE Estágio 4 (DECISION Op1 / Clayton 2026-06-05): a empresa PJ CLASSIFICADA é a fonte do company_type.
   * Quando presente, o Stage 4 deriva o tipo de `companies.primary_company_type_id` (NÃO de
   * `tenants.company_type_id`). Sem companyId = path LEGADO/compat (lê tenant). Nunca popular tenants.company_type_id.
   */
  companyId?: string;
  /** Se omitido: com companyId deriva de `companies.primary_company_type_id`; sem companyId, de `tenants.company_type_id` (legado). */
  departmentCategoryId?: string;
  /** Se omitido junto com department, pode ser preenchido pela herança do tipo de empresa. */
  selectedCategoryIds?: string[];
  hasOwnProducts: boolean; // Se a loja possui fabricação própria
  defaultCostPrice?: number; // Preço de custo padrão (opcional)
  defaultSalePrice?: number; // Preço de venda padrão (opcional)
  defaultStock?: number; // Estoque inicial padrão (opcional)
  /** Opcional: materializa canónicos em falta antes do loop PRODUCT → OFFER (GTIN + nome/marca/categoria). */
  seedCanonicalLines?: StoreOnboardingSeedCanonicalLine[];
  metadata?: Record<string, any>;
}

/**
 * Resultado do onboarding
 */
export interface StoreOnboardingResult {
  storeId: string; // ID da loja (actorId)
  departmentCategoryId: string;
  selectedCategoryIds: string[];
  hasOwnProducts: boolean;
  importedProductsCount: number; // Quantidade de produtos importados do catálogo
  createdOffersCount: number; // Quantidade de ofertas criadas
  categoriesImported: boolean; // Se as categorias foram importadas com sucesso
  metadata?: Record<string, any>;
}

/**
 * Produto do catálogo disponível para importação
 * `canonicalProductId` = id em `canonical_products` (não confundir com `products.id` do tenant).
 */
export interface AvailableCatalogProduct {
  canonicalProductId: string;
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




