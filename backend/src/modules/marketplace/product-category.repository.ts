// backend/src/modules/marketplace/product-category.repository.ts
// SPRINT 37.1: MARKETPLACE CORE - Catálogo Canônico
// Repository para categorias de produtos
// ADAPTER: Usa productCategoryAdapter que lê de categories (core)

import { productCategoryAdapter } from './product-category-adapter';
import type {
  ProductCategory,
  CreateProductCategoryInput,
  UpdateProductCategoryInput,
  ListProductCategoriesOptions,
} from './product-catalog.types';

interface ProductCategoryRow {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  is_active: boolean;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class ProductCategoryRepository {
  async createCategory(
    tenantId: string,
    input: CreateProductCategoryInput
  ): Promise<ProductCategory> {
    return productCategoryAdapter.createCategory(tenantId, input);
  }

  async getCategoryById(
    tenantId: string,
    categoryId: string
  ): Promise<ProductCategory | null> {
    return productCategoryAdapter.getCategoryById(tenantId, categoryId);
  }

  async getCategoryBySlug(
    tenantId: string,
    slug: string
  ): Promise<ProductCategory | null> {
    return productCategoryAdapter.getCategoryBySlug(tenantId, slug);
  }

  async listCategories(
    tenantId: string,
    options: ListProductCategoriesOptions = {}
  ): Promise<ProductCategory[]> {
    return productCategoryAdapter.listCategories(tenantId, options);
  }

  async updateCategory(
    tenantId: string,
    categoryId: string,
    input: UpdateProductCategoryInput
  ): Promise<ProductCategory> {
    return productCategoryAdapter.updateCategory(tenantId, categoryId, input);
  }

  async getChildCategories(
    tenantId: string,
    parentId: string
  ): Promise<ProductCategory[]> {
    return productCategoryAdapter.getChildCategories(tenantId, parentId);
  }
}

export const productCategoryRepository = new ProductCategoryRepository();








