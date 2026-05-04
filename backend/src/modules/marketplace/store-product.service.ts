// backend/src/modules/marketplace/store-product.service.ts
// FASE X — Bloco 3: Store Products / Activations (substitui this.products e this.storeProductActivations)

import { productCatalogService } from './product-catalog.service';
import { storeProductRepository } from './store-product.repository';

export interface StoreProductItem {
  productId: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  attributes?: Record<string, unknown>;
  images?: string[];
  isEnabled: boolean;
  price: { amountCents: number; currency: string } | null;
  stock: { quantity: number; unit: string } | null;
  industryId?: string;
  hubId?: string;
  is_industrial?: boolean;
}

export interface GetStoreProductsResult {
  domain: string;
  version: string;
  storeId: string;
  products: StoreProductItem[];
}

class StoreProductService {
  async getStoreProducts(
    tenantId: string,
    storeId: string,
    categoryId?: string | null
  ): Promise<GetStoreProductsResult> {
    const activations = await storeProductRepository.listByStore(tenantId, storeId, true);
    const products: StoreProductItem[] = [];

    for (const act of activations) {
      const product = await productCatalogService.getProductById(tenantId, act.product_id);
      if (!product) continue;
      if (categoryId != null && product.categoryId !== categoryId) continue;

      products.push({
        productId: product.id,
        name: product.name,
        description: (product.description ?? null) as string | null,
        categoryId: (product.categoryId ?? null) as string | null,
        attributes: product.metadata as Record<string, unknown> | undefined,
        images: [],
        isEnabled: act.status === 'active',
        price: null,
        stock: null,
        is_industrial: product.productType === 'industrial',
      });
    }

    return {
      domain: 'marketplace',
      version: 'v0',
      storeId,
      products,
    };
  }

  async activateProduct(tenantId: string, storeId: string, productId: string): Promise<void> {
    await storeProductRepository.activateProduct(tenantId, storeId, productId);
  }

  async deactivateProduct(tenantId: string, storeId: string, productId: string): Promise<void> {
    await storeProductRepository.deactivateProduct(tenantId, storeId, productId);
  }

  /** Adiciona produto à loja (ex.: import com status inactive) */
  async addProductToStore(
    tenantId: string,
    storeId: string,
    productId: string,
    status: 'active' | 'inactive' = 'inactive'
  ): Promise<void> {
    await storeProductRepository.upsertActivation(tenantId, storeId, productId, status);
  }

  async hasActivation(tenantId: string, storeId: string, productId: string): Promise<boolean> {
    const act = await storeProductRepository.getActivation(tenantId, storeId, productId);
    return act != null;
  }

  /** Verifica se já existe ativação para um produto que corresponde ao template (via metadata.templateId) */
  async hasActivationForTemplate(
    tenantId: string,
    storeId: string,
    templateId: string
  ): Promise<boolean> {
    const activations = await storeProductRepository.listByStore(tenantId, storeId, false);
    for (const act of activations) {
      const product = await productCatalogService.getProductById(tenantId, act.product_id, {
        includeNonReady: true,
      });
      if (product?.metadata && (product.metadata as { templateId?: string }).templateId === templateId) {
        return true;
      }
    }
    return false;
  }

  /** Obtém productId do catálogo cujo metadata.templateId é o dado (ou null) */
  async findProductByTemplateId(tenantId: string, templateId: string): Promise<string | null> {
    const list = await productCatalogService.listProducts(tenantId, { includeNonReady: true });
    const found = list.find(
      p => p.metadata && (p.metadata as { templateId?: string }).templateId === templateId
    );
    return found?.id ?? null;
  }
}

export const storeProductService = new StoreProductService();