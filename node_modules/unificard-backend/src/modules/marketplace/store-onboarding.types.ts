// backend/src/modules/marketplace/store-onboarding.types.ts
// Store Onboarding - Tipos
// 🔴 BLINDAGEM: Loja apenas seleciona recortes da taxonomia, não cria categorias

/**
 * Input para criar onboarding de loja
 */
export interface StoreOnboardingInput {
  actorId: string; // ID da empresa/loja
  departmentCategoryId: string; // Categoria raiz (nível 0)
  selectedCategoryIds: string[]; // Subcategorias selecionadas (nível 1)
  hasOwnProducts: boolean; // Se a loja possui fabricação própria
  defaultCostPrice?: number; // Preço de custo padrão (opcional)
  defaultSalePrice?: number; // Preço de venda padrão (opcional)
  defaultStock?: number; // Estoque inicial padrão (opcional)
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




