// backend/src/modules/marketplace/product-catalog.service.ts
// SPRINT 37.1: MARKETPLACE CORE - Catálogo Canônico
// SPRINT 37.2: MARKETPLACE CORE - Produto & Variante
// Service para categorias, atributos, produtos e variantes
// TODO: ADAPTER -> categories (core) - productCategoryRepository será substituído por adapter sobre categories core

import { productCategoryRepository } from './product-category.repository';
import { productAttributeRepository } from './product-attribute.repository';
import { productRepository } from './product.repository';
import { productVariantRepository } from './product-variant.repository';
import type {
  ProductCategory,
  ProductAttribute,
  CreateProductCategoryInput,
  UpdateProductCategoryInput,
  ListProductCategoriesOptions,
  CreateProductAttributeInput,
  UpdateProductAttributeInput,
  ListProductAttributesOptions,
  Product,
  CreateProductInput,
  UpdateProductInput,
  ListProductsOptions,
  ProductVariant,
  CreateProductVariantInput,
  UpdateProductVariantInput,
} from './product-catalog.types';

/**
 * Service para catálogo de produtos
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Categorias, atributos, produtos e variantes são DECLARATIVOS (não executam regras)
 * - Produto é conceitual (não possui SKU, preço ou estoque)
 * - Variante contém SKU/PLU e representa forma física/comercial
 * - Validações básicas (não inteligentes): SKU único, PLU baseado em product_type
 * - Nenhum side-effect
 * - Nenhuma integração com venda/pedido/pagamento/estoque
 */
class ProductCatalogService {
  // ============================================================
  // CATEGORIAS
  // ============================================================

  /**
   * Cria categoria
   * LEGACY BLOCKED — categories (core) é a única árvore
   */
  async createCategory(
    tenantId: string,
    input: CreateProductCategoryInput
  ): Promise<ProductCategory> {
    // LEGACY BLOCKED — escrita em catalog_categories bloqueada
    // Usar categoriesService diretamente para criar categorias
    const error = new Error('LEGACY_WRITE_BLOCKED: Escrita em catalog_categories bloqueada. Use categoriesService para criar categorias em categories (core).');
    (error as any).code = 'LEGACY_WRITE_BLOCKED';
    throw error;
  }

  /**
   * Lista categorias
   * TODO: ADAPTER -> categories (core) - Migrar para usar categoriesService ao invés de productCategoryRepository
   */
  async listCategories(
    tenantId: string,
    options: ListProductCategoriesOptions = {}
  ): Promise<ProductCategory[]> {
    return await productCategoryRepository.listCategories(tenantId, options);
  }

  /**
   * Busca categoria por ID
   * TODO: ADAPTER -> categories (core) - Migrar para usar categoriesService ao invés de productCategoryRepository
   */
  async getCategoryById(
    tenantId: string,
    categoryId: string
  ): Promise<ProductCategory | null> {
    return await productCategoryRepository.getCategoryById(tenantId, categoryId);
  }

  /**
   * Busca categoria por slug
   * TODO: ADAPTER -> categories (core) - Migrar para usar categoriesService ao invés de productCategoryRepository
   */
  async getCategoryBySlug(
    tenantId: string,
    slug: string
  ): Promise<ProductCategory | null> {
    return await productCategoryRepository.getCategoryBySlug(tenantId, slug);
  }

  /**
   * Atualiza categoria
   */
  async updateCategory(
    tenantId: string,
    categoryId: string,
    input: UpdateProductCategoryInput
  ): Promise<ProductCategory> {
    // Verificar se categoria existe
    const existing = await productCategoryRepository.getCategoryById(
      tenantId,
      categoryId
    );

    if (!existing) {
      throw new Error(`Categoria não encontrada: ${categoryId}`);
    }

    // Verificar slug se fornecido
    if (input.slug && input.slug !== existing.slug) {
      const slugExists = await productCategoryRepository.getCategoryBySlug(
        tenantId,
        input.slug
      );

      if (slugExists) {
        throw new Error(`Categoria com slug "${input.slug}" já existe`);
      }
    }

    // LEGACY BLOCKED — escrita em catalog_categories bloqueada
    // Usar categoriesService diretamente para atualizar categorias
    const error = new Error('LEGACY_WRITE_BLOCKED: Escrita em catalog_categories bloqueada. Use categoriesService para atualizar categorias em categories (core).');
    (error as any).code = 'LEGACY_WRITE_BLOCKED';
    throw error;
  }

  /**
   * Busca categorias filhas
   */
  async getChildCategories(
    tenantId: string,
    parentId: string
  ): Promise<ProductCategory[]> {
    return await productCategoryRepository.getChildCategories(tenantId, parentId);
  }

  // ============================================================
  // ATRIBUTOS
  // ============================================================

  /**
   * Cria atributo
   */
  async createAttribute(
    tenantId: string,
    input: CreateProductAttributeInput
  ): Promise<ProductAttribute> {
    // Verificar se slug já existe
    const existing = await productAttributeRepository.getAttributeBySlug(
      tenantId,
      input.slug
    );

    if (existing) {
      throw new Error(`Atributo com slug "${input.slug}" já existe`);
    }

    // Verificar applies_to_category_id se fornecido
    if (input.appliesToCategoryId) {
      const category = await productCategoryRepository.getCategoryById(
        tenantId,
        input.appliesToCategoryId
      );

      if (!category) {
        throw new Error(
          `Categoria não encontrada: ${input.appliesToCategoryId}`
        );
      }
    }

    return await productAttributeRepository.createAttribute(tenantId, input);
  }

  /**
   * Lista atributos
   */
  async listAttributes(
    tenantId: string,
    options: ListProductAttributesOptions = {}
  ): Promise<ProductAttribute[]> {
    return await productAttributeRepository.listAttributes(tenantId, options);
  }

  /**
   * Busca atributo por ID
   */
  async getAttributeById(
    tenantId: string,
    attributeId: string
  ): Promise<ProductAttribute | null> {
    return await productAttributeRepository.getAttributeById(tenantId, attributeId);
  }

  /**
   * Busca atributo por slug
   */
  async getAttributeBySlug(
    tenantId: string,
    slug: string
  ): Promise<ProductAttribute | null> {
    return await productAttributeRepository.getAttributeBySlug(tenantId, slug);
  }

  /**
   * Atualiza atributo
   */
  async updateAttribute(
    tenantId: string,
    attributeId: string,
    input: UpdateProductAttributeInput
  ): Promise<ProductAttribute> {
    // Verificar se atributo existe
    const existing = await productAttributeRepository.getAttributeById(
      tenantId,
      attributeId
    );

    if (!existing) {
      throw new Error(`Atributo não encontrado: ${attributeId}`);
    }

    // Verificar slug se fornecido
    if (input.slug && input.slug !== existing.slug) {
      const slugExists = await productAttributeRepository.getAttributeBySlug(
        tenantId,
        input.slug
      );

      if (slugExists) {
        throw new Error(`Atributo com slug "${input.slug}" já existe`);
      }
    }

    // Verificar applies_to_category_id se fornecido
    if (
      input.appliesToCategoryId !== undefined &&
      input.appliesToCategoryId !== existing.appliesToCategoryId
    ) {
      if (input.appliesToCategoryId) {
        const category = await productCategoryRepository.getCategoryById(
          tenantId,
          input.appliesToCategoryId
        );

        if (!category) {
          throw new Error(
            `Categoria não encontrada: ${input.appliesToCategoryId}`
          );
        }
      }
    }

    return await productAttributeRepository.updateAttribute(
      tenantId,
      attributeId,
      input
    );
  }

  /**
   * Busca atributos aplicáveis a uma categoria
   * Retorna atributos globais + atributos específicos da categoria
   */
  async getAttributesForCategory(
    tenantId: string,
    categoryId: string
  ): Promise<ProductAttribute[]> {
    // Verificar se categoria existe
    const category = await productCategoryRepository.getCategoryById(
      tenantId,
      categoryId
    );

    if (!category) {
      throw new Error(`Categoria não encontrada: ${categoryId}`);
    }

    return await productAttributeRepository.getAttributesForCategory(
      tenantId,
      categoryId
    );
  }

  // ============================================================
  // PRODUTOS
  // ============================================================

  /**
   * Cria produto
   */
  async createProduct(
    tenantId: string,
    input: CreateProductInput
  ): Promise<Product> {
    // Verificar categoria se fornecido
    if (input.categoryId) {
      const category = await productCategoryRepository.getCategoryById(
        tenantId,
        input.categoryId
      );

      if (!category) {
        throw new Error(`Categoria não encontrada: ${input.categoryId}`);
      }
    }

    return await productRepository.createProduct(tenantId, input);
  }

  /**
   * Lista produtos
   */
  async listProducts(
    tenantId: string,
    options: ListProductsOptions = {}
  ): Promise<Product[]> {
    return await productRepository.listProducts(tenantId, options);
  }

  /**
   * Busca produto por ID
   */
  async getProductById(
    tenantId: string,
    productId: string
  ): Promise<Product | null> {
    return await productRepository.getProductById(tenantId, productId);
  }

  /**
   * Atualiza produto
   */
  async updateProduct(
    tenantId: string,
    productId: string,
    input: UpdateProductInput
  ): Promise<Product> {
    // Verificar se produto existe
    const existing = await productRepository.getProductById(
      tenantId,
      productId
    );

    if (!existing) {
      throw new Error(`Produto não encontrado: ${productId}`);
    }

    // Verificar categoria se fornecido
    if (input.categoryId !== undefined && input.categoryId !== existing.categoryId) {
      if (input.categoryId) {
        const category = await productCategoryRepository.getCategoryById(
          tenantId,
          input.categoryId
        );

        if (!category) {
          throw new Error(`Categoria não encontrada: ${input.categoryId}`);
        }
      }
    }

    return await productRepository.updateProduct(tenantId, productId, input);
  }

  // ============================================================
  // VARIANTES
  // ============================================================

  /**
   * Cria variante
   * 
   * Validações básicas (não inteligentes):
   * - SKU único por tenant
   * - product_type define regras para PLU:
   *   - UNIT → sem PLU
   *   - WEIGHT → PLU permitido
   *   - LOT → sem PLU (por enquanto)
   */
  async createVariant(
    tenantId: string,
    input: CreateProductVariantInput
  ): Promise<ProductVariant> {
    // Verificar se produto existe
    const product = await productRepository.getProductById(
      tenantId,
      input.productId
    );

    if (!product) {
      throw new Error(`Produto não encontrado: ${input.productId}`);
    }

    // Verificar se SKU já existe
    const existingSku = await productVariantRepository.getVariantBySku(
      tenantId,
      input.sku
    );

    if (existingSku) {
      throw new Error(`Variante com SKU "${input.sku}" já existe`);
    }

    // Validações básicas baseadas em product_type
    if (input.plu) {
      if (product.productType === 'UNIT') {
        throw new Error('Produtos UNIT não podem ter PLU');
      }
      if (product.productType === 'LOT') {
        throw new Error('Produtos LOT não podem ter PLU (por enquanto)');
      }
      // WEIGHT permite PLU
    }

    return await productVariantRepository.createVariant(tenantId, input);
  }

  /**
   * Lista variantes de um produto
   */
  async listVariantsByProduct(
    tenantId: string,
    productId: string,
    includeInactive: boolean = false
  ): Promise<ProductVariant[]> {
    // Verificar se produto existe
    const product = await productRepository.getProductById(tenantId, productId);

    if (!product) {
      throw new Error(`Produto não encontrado: ${productId}`);
    }

    return await productVariantRepository.listVariantsByProduct(
      tenantId,
      productId,
      includeInactive
    );
  }

  /**
   * Busca variante por ID
   */
  async getVariantById(
    tenantId: string,
    variantId: string
  ): Promise<ProductVariant | null> {
    return await productVariantRepository.getVariantById(tenantId, variantId);
  }

  /**
   * Busca variante por SKU
   */
  async getVariantBySku(
    tenantId: string,
    sku: string
  ): Promise<ProductVariant | null> {
    return await productVariantRepository.getVariantBySku(tenantId, sku);
  }

  /**
   * Atualiza variante
   */
  async updateVariant(
    tenantId: string,
    variantId: string,
    input: UpdateProductVariantInput
  ): Promise<ProductVariant> {
    // Verificar se variante existe
    const existing = await productVariantRepository.getVariantById(
      tenantId,
      variantId
    );

    if (!existing) {
      throw new Error(`Variante não encontrada: ${variantId}`);
    }

    // Verificar SKU se fornecido
    if (input.sku && input.sku !== existing.sku) {
      const skuExists = await productVariantRepository.getVariantBySku(
        tenantId,
        input.sku
      );

      if (skuExists) {
        throw new Error(`Variante com SKU "${input.sku}" já existe`);
      }
    }

    // Validações básicas baseadas em product_type do produto
    if (input.plu !== undefined && input.plu !== existing.plu) {
      const product = await productRepository.getProductById(
        tenantId,
        existing.productId
      );

      if (!product) {
        throw new Error(`Produto não encontrado: ${existing.productId}`);
      }

      if (input.plu) {
        if (product.productType === 'UNIT') {
          throw new Error('Produtos UNIT não podem ter PLU');
        }
        if (product.productType === 'LOT') {
          throw new Error('Produtos LOT não podem ter PLU (por enquanto)');
        }
        // WEIGHT permite PLU
      }
    }

    return await productVariantRepository.updateVariant(
      tenantId,
      variantId,
      input
    );
  }
}

export const productCatalogService = new ProductCatalogService();

