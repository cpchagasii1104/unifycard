// backend/src/modules/marketplace/product-category-adapter.ts
// Adapter de leitura: product_categories -> categories (core)
// Mantém assinatura pública de ProductCategoryRepository para compatibilidade

import { categoriesService } from '@core/categories/categories.service';
import { CategoryRepository } from '@core/categories/categories.repository';
import { CategoryModel } from '@core/categories/categories.model';
import type {
  ProductCategory,
  CreateProductCategoryInput,
  UpdateProductCategoryInput,
  ListProductCategoriesOptions,
} from './product-catalog.types';

class ProductCategoryAdapter {
  private categoryRepository = new CategoryRepository();

  private toProductCategory(category: any, tenantId: string): ProductCategory {
    const metadata = category.metadata || {};
    return {
      id: category.categoryId,
      tenantId,
      name: category.name,
      slug: category.slug,
      parentId: category.parentId || null,
      isActive: category.status === 'active' || category.status === 'auto_active' || (category.status === null && true),
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
      createdAt: category.createdAt || new Date(),
      updatedAt: category.updatedAt || new Date(),
    };
  }

  async createCategory(
    tenantId: string,
    input: CreateProductCategoryInput
  ): Promise<ProductCategory> {
    // LEGACY BLOCKED — categories (core) é a única árvore
    const error = new Error('LEGACY_WRITE_BLOCKED: Escrita em catalog_categories bloqueada. Use categoriesService para criar categorias em categories (core).');
    (error as any).code = 'LEGACY_WRITE_BLOCKED';
    throw error;
  }

  async getCategoryById(
    tenantId: string,
    categoryId: string
  ): Promise<ProductCategory | null> {
    const categoryRow = await this.categoryRepository.findById(categoryId);
    if (!categoryRow) {
      return null;
    }
    const category = CategoryModel.fromRow(categoryRow);
    return this.toProductCategory({ ...category, metadata: (categoryRow as any).metadata }, tenantId);
  }

  async getCategoryBySlug(
    tenantId: string,
    slug: string
  ): Promise<ProductCategory | null> {
    const categoryRow = await this.categoryRepository.findBySlug(slug);
    if (!categoryRow) {
      return null;
    }
    const category = CategoryModel.fromRow(categoryRow);
    return this.toProductCategory({ ...category, metadata: (categoryRow as any).metadata }, tenantId);
  }

  async listCategories(
    tenantId: string,
    options: ListProductCategoriesOptions = {}
  ): Promise<ProductCategory[]> {
    const allRows = await this.categoryRepository.findAll(undefined, 'professional' as any);
    let filteredRows = allRows;

    if (options.parentId !== undefined) {
      if (options.parentId === null) {
        filteredRows = filteredRows.filter((row: any) => !row.parent_id);
      } else {
        filteredRows = filteredRows.filter((row: any) => row.parent_id === options.parentId);
      }
    }

    if (options.isActive !== undefined && !options.includeInactive) {
      const isActive = options.isActive !== false;
      filteredRows = filteredRows.filter((row: any) => {
        const status = row.status;
        const active = status === 'active' || status === 'auto_active' || (status === null && true);
        return active === isActive;
      });
    }

    return filteredRows.map((row: any) => {
      const category = CategoryModel.fromRow(row);
      return this.toProductCategory({ ...category, metadata: row.metadata }, tenantId);
    });
  }

  async updateCategory(
    tenantId: string,
    categoryId: string,
    input: UpdateProductCategoryInput
  ): Promise<ProductCategory> {
    // LEGACY BLOCKED — categories (core) é a única árvore
    const error = new Error('LEGACY_WRITE_BLOCKED: Escrita em catalog_categories bloqueada. Use categoriesService para atualizar categorias em categories (core).');
    (error as any).code = 'LEGACY_WRITE_BLOCKED';
    throw error;
  }

  async getChildCategories(
    tenantId: string,
    parentId: string
  ): Promise<ProductCategory[]> {
    const children = await categoriesService.getChildren(parentId);
    return Promise.all(children.map(async (c) => {
      const categoryRow = await this.categoryRepository.findById(c.categoryId);
      const metadata = categoryRow ? (categoryRow as any).metadata : {};
      return this.toProductCategory({ ...c, metadata }, tenantId);
    }));
  }
}

export const productCategoryAdapter = new ProductCategoryAdapter();

