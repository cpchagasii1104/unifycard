// backend/src/modules/marketplace/store-onboarding.service.ts
// Store Onboarding Service
// 🔴 BLINDAGEM: Loja apenas seleciona recortes, não cria categorias ou produtos

import type {
  StoreOnboardingInput,
  StoreOnboardingResult,
  AvailableCatalogProduct,
  CategoryProductStats,
} from './store-onboarding.types';
import { marketplaceCategoriesService } from './marketplace-categories.service';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { recordBusinessAuditSafely } from '@modules/business-audit/business-audit.helpers';

interface CanonicalProductRow {
  id: string;
  tenant_id: string;
  gtin: string;
  name: string;
  brand: string | null;
  images: string[];
  attributes: Record<string, any>;
  category_id: string | null;
}

interface ProductOfferRow {
  id: string;
  tenant_id: string;
  product_id: string;
  merchant_id: string;
  price: string;
  stock: number | null;
  location_region_id: string | null;
  location_city_id: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

class StoreOnboardingService {
  /**
   * Cria onboarding de loja
   * 🔴 BLINDAGEM: Apenas seleciona categorias e importa produtos, não cria nada novo
   */
  async createStoreOnboarding(
    tenantId: string,
    input: StoreOnboardingInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<StoreOnboardingResult> {
    // 1. Validar que todas as categorias são do domínio marketplace
    await this.validateMarketplaceCategories(tenantId, [
      input.departmentCategoryId,
      ...input.selectedCategoryIds,
    ]);

    // 2. Importar categorias selecionadas para a loja
    const categoriesImported = await marketplaceCategoriesService.importCategories(
      tenantId,
      input.actorId,
      {
        categoryIds: [input.departmentCategoryId, ...input.selectedCategoryIds],
        metadata: {
          onboardingDate: new Date().toISOString(),
          hasOwnProducts: input.hasOwnProducts,
          ...input.metadata,
        },
      },
      createdByActorId
    );

    // 3. Buscar produtos do catálogo canônico nas categorias selecionadas
    const catalogProducts = await this.findCatalogProductsByCategories(
      tenantId,
      input.selectedCategoryIds
    );

    // 4. Criar ofertas (product_offers) para cada produto encontrado
    let createdOffersCount = 0;
    for (const product of catalogProducts) {
      // Verificar se já existe oferta para este produto e merchant
      const existingOffer = await this.findOfferByProductAndMerchant(
        tenantId,
        product.id,
        input.actorId
      );

      if (!existingOffer) {
        await this.createProductOffer(tenantId, {
          productId: product.id,
          merchantId: input.actorId,
          price: input.defaultSalePrice || 0,
          stock: input.defaultStock || null,
          active: true,
        });
        createdOffersCount++;
      }
    }

    // 5. Registrar auditoria
    await recordBusinessAuditSafely(
      tenantId,
      createdByActorId,
      'MARKETPLACE_STORE_ONBOARDED',
      {
        actorId: input.actorId,
        departmentCategoryId: input.departmentCategoryId,
        selectedCategoryIds: input.selectedCategoryIds,
        hasOwnProducts: input.hasOwnProducts,
        importedProductsCount: catalogProducts.length,
        createdOffersCount,
        contextType: 'ACTOR',
        contextId: input.actorId,
        userId: createdByUserId,
      }
    );

    return {
      storeId: input.actorId,
      departmentCategoryId: input.departmentCategoryId,
      selectedCategoryIds: input.selectedCategoryIds,
      hasOwnProducts: input.hasOwnProducts,
      importedProductsCount: catalogProducts.length,
      createdOffersCount,
      categoriesImported: true,
      metadata: input.metadata,
    };
  }

  /**
   * Lista produtos do catálogo disponíveis para importação por categoria
   */
  async listAvailableCatalogProducts(
    tenantId: string,
    categoryIds: string[]
  ): Promise<AvailableCatalogProduct[]> {
    if (categoryIds.length === 0) {
      return [];
    }

    const query = `
      SELECT 
        cp.id,
        cp.tenant_id,
        cp.gtin,
        cp.name,
        cp.brand,
        cp.images,
        cp.attributes,
        cp.category_id,
        c.name as category_name
      FROM canonical_products cp
      LEFT JOIN categories c ON cp.category_id = c.category_id
      WHERE cp.tenant_id = $1
        AND cp.category_id = ANY($2::uuid[])
        AND cp.type = 'INDUSTRIAL'
      ORDER BY cp.name ASC
    `;

    const rows = await runQueriesWithTenant<CanonicalProductRow & { category_name: string | null }>(
      tenantId,
      query,
      [tenantId, categoryIds]
    );

    return rows.map((row) => ({
      productId: row.id,
      gtin: row.gtin,
      name: row.name,
      brand: row.brand || undefined,
      categoryId: row.category_id || '',
      categoryName: row.category_name || '',
      images: row.images || [],
      attributes: row.attributes || {},
    }));
  }

  /**
   * Retorna estatísticas de produtos disponíveis por categoria
   */
  async getCategoryProductStats(
    tenantId: string,
    categoryIds: string[]
  ): Promise<CategoryProductStats[]> {
    if (categoryIds.length === 0) {
      return [];
    }

    const query = `
      SELECT 
        c.category_id,
        c.name as category_name,
        COUNT(cp.id) as available_products_count
      FROM categories c
      LEFT JOIN canonical_products cp ON cp.category_id = c.category_id 
        AND cp.tenant_id = $1 
        AND cp.type = 'INDUSTRIAL'
      WHERE c.category_id = ANY($2::uuid[])
        AND c.metadata->>'domain' = 'marketplace'
      GROUP BY c.category_id, c.name
      ORDER BY c.name ASC
    `;

    const rows = await runQueriesWithTenant<{
      category_id: string;
      category_name: string;
      available_products_count: string;
    }>(tenantId, query, [tenantId, categoryIds]);

    return rows.map((row) => ({
      categoryId: row.category_id,
      categoryName: row.category_name,
      availableProductsCount: parseInt(row.available_products_count, 10),
    }));
  }

  /**
   * Valida que todas as categorias são do domínio marketplace
   */
  private async validateMarketplaceCategories(
    tenantId: string,
    categoryIds: string[]
  ): Promise<void> {
    for (const categoryId of categoryIds) {
      const category = await marketplaceCategoriesService.getCategoryById(categoryId);
      if (!category) {
        throw new Error(`Categoria ${categoryId} não encontrada`);
      }
      if (category.metadata?.domain !== 'marketplace') {
        throw new Error(`Categoria ${categoryId} não é do domínio marketplace`);
      }
    }
  }

  /**
   * Busca produtos do catálogo canônico por categorias
   */
  private async findCatalogProductsByCategories(
    tenantId: string,
    categoryIds: string[]
  ): Promise<CanonicalProductRow[]> {
    if (categoryIds.length === 0) {
      return [];
    }

    const query = `
      SELECT 
        id, tenant_id, gtin, name, brand, images, attributes, category_id
      FROM canonical_products
      WHERE tenant_id = $1
        AND category_id = ANY($2::uuid[])
        AND type = 'INDUSTRIAL'
      ORDER BY name ASC
    `;

    return await runQueriesWithTenant<CanonicalProductRow>(tenantId, query, [tenantId, categoryIds]);
  }

  /**
   * Busca oferta existente por produto e merchant
   */
  private async findOfferByProductAndMerchant(
    tenantId: string,
    productId: string,
    merchantId: string
  ): Promise<ProductOfferRow | null> {
    const row = await runQueryWithTenant<ProductOfferRow>(
      tenantId,
      `
      SELECT id, tenant_id, product_id, merchant_id, price, stock, 
             location_region_id, location_city_id, active, created_at, updated_at
      FROM product_offers
      WHERE tenant_id = $1 AND product_id = $2 AND merchant_id = $3
      LIMIT 1
      `,
      [tenantId, productId, merchantId]
    );

    return row || null;
  }

  /**
   * Cria oferta de produto
   */
  private async createProductOffer(
    tenantId: string,
    offer: {
      productId: string;
      merchantId: string;
      price: number;
      stock?: number | null;
      active?: boolean;
    }
  ): Promise<ProductOfferRow> {
    const query = `
      INSERT INTO product_offers (
        tenant_id, product_id, merchant_id, price, stock, active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, tenant_id, product_id, merchant_id, price, stock, 
                location_region_id, location_city_id, active, created_at, updated_at
    `;

    const row = await runQueryWithTenant<ProductOfferRow>(tenantId, query, [
      tenantId,
      offer.productId,
      offer.merchantId,
      offer.price,
      offer.stock || null,
      offer.active !== false,
    ]);

    return row!;
  }
}

export const storeOnboardingService = new StoreOnboardingService();

