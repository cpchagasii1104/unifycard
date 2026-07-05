// backend/src/modules/marketplace/product-catalog.types.ts
// SPRINT 37.1: MARKETPLACE CORE - Catálogo Canônico
// Tipos para categorias, atributos e tipos de produto

/**
 * Tipo de produto
 * Define COMO o produto se comporta no estoque, não como é vendido
 */
export type ProductType = 'UNIT' | 'WEIGHT' | 'LOT' | 'industrial';

/**
 * Tipo de dado de um atributo
 */
export type ProductAttributeDataType = 'string' | 'number' | 'boolean' | 'enum';

/**
 * Categoria de produto
 */
export interface ProductCategory {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  parentId?: string | null;
  isActive: boolean;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar categoria
 */
export interface CreateProductCategoryInput {
  name: string;
  slug: string;
  parentId?: string | null;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Input para atualizar categoria
 */
export interface UpdateProductCategoryInput {
  name?: string;
  slug?: string;
  parentId?: string | null;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Opções de busca de categorias
 */
export interface ListProductCategoriesOptions {
  parentId?: string | null;
  isActive?: boolean;
  includeInactive?: boolean;
}

/**
 * Atributo de produto
 */
export interface ProductAttribute {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  dataType: ProductAttributeDataType;
  unit?: string | null;
  isRequired: boolean;
  appliesToCategoryId?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar atributo
 */
export interface CreateProductAttributeInput {
  name: string;
  slug: string;
  dataType: ProductAttributeDataType;
  unit?: string | null;
  isRequired?: boolean;
  appliesToCategoryId?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Input para atualizar atributo
 */
export interface UpdateProductAttributeInput {
  name?: string;
  slug?: string;
  dataType?: ProductAttributeDataType;
  unit?: string | null;
  isRequired?: boolean;
  appliesToCategoryId?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Opções de busca de atributos
 */
export interface ListProductAttributesOptions {
  appliesToCategoryId?: string | null;
  dataType?: ProductAttributeDataType;
  isRequired?: boolean;
}

/**
 * Produto conceitual
 * Não possui SKU, preço ou estoque
 */
export interface Product {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  /** Opcional: UUID do registo em `canonical_products` (`products.canonical_product_id`). */
  canonicalProductId?: string | null;
  productType: ProductType;
  isActive: boolean;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar produto
 */
export interface CreateProductInput {
  name: string;
  description?: string | null;
  // DT-DRIFT-CONTRACT-INTERFACE-RUNTIME (2026-05-17, corrigida 2026-07-05): o tipo dizia opcional,
  // mas product.repository.ts::requireCategoryIdForProductCreate SEMPRE exige (lança
  // CATEGORY_REQUIRED se ausente/vazio) — regra "P0 RFC 0" já era obrigatória em runtime. Tipo
  // corrigido pra refletir a verdade do repository (schema/runtime é SSOT, tipo é projeção).
  categoryId: string;
  /** Opcional: persiste em `products.canonical_product_id`. */
  canonicalProductId?: string | null;
  /**
   * Opcional (DECISION-0108): empresa CLASSIFICADA cujo `primary_company_type_id` governa o recorte
   * por categoria/ramo do guard. Ausente → legado/compat (guard lê `tenants.company_type_id`).
   * Não é persistido em `products` — só contextualiza o guard.
   */
  companyId?: string | null;
  productType: ProductType;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Input para atualizar produto
 */
export interface UpdateProductInput {
  name?: string;
  description?: string | null;
  categoryId?: string | null;
  productType?: ProductType;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Opções de busca de produtos
 */
export interface ListProductsOptions {
  categoryId?: string | null;
  productType?: ProductType;
  isActive?: boolean;
  includeInactive?: boolean;
  /** Backoffice: incluir produtos com canónico INDUSTRIAL ainda não READY */
  includeNonReady?: boolean;
}

/**
 * Variante de produto
 * Representa forma física/comercial e contém SKU/PLU
 */
export interface ProductVariant {
  id: string;
  tenantId: string;
  productId: string;
  sku: string;
  plu?: string | null;
  attributes?: Record<string, any> | null;
  isActive: boolean;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar variante
 */
export interface CreateProductVariantInput {
  productId: string;
  sku: string;
  plu?: string | null;
  attributes?: Record<string, any>;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

/**
 * Input para atualizar variante
 */
export interface UpdateProductVariantInput {
  sku?: string;
  plu?: string | null;
  attributes?: Record<string, any>;
  isActive?: boolean;
  metadata?: Record<string, any>;
}


