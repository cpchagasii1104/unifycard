// backend/src/core/profile/profile-health-taxonomy-adapter.ts
// Adapter de leitura: health_taxonomies -> categories (core)
// Mantém assinatura pública de ProfileHealthTaxonomyRepository para compatibilidade

import { categoriesService } from '@core/categories/categories.service';
import { CategoryRepository } from '@core/categories/categories.repository';
import { CategoryModel } from '@core/categories/categories.model';
import type { HealthTaxonomy, HealthCategory, HealthFactType } from './profile-health-taxonomy.repository';

class ProfileHealthTaxonomyAdapter {
  private categoryRepository = new CategoryRepository();

  private toHealthTaxonomy(category: any, tenantId: string): HealthTaxonomy | null {
    if (!category) {
      return null;
    }
    const metadata = (category as any).metadata || {};
    const categoryField = metadata.category as HealthCategory;
    const factType = metadata.factType as HealthFactType;

    if (!categoryField || !factType) {
      return null;
    }

    return {
      taxonomyId: category.categoryId,
      tenantId,
      name: category.name,
      slug: category.slug,
      category: categoryField,
      factType: factType,
      parentId: category.parentId || null,
      description: category.description || null,
      metadata: metadata,
      isActive: category.status === 'active' || category.status === 'auto_active' || (category.status === null && true),
      createdAt: category.createdAt || new Date(),
      updatedAt: category.updatedAt || new Date(),
    };
  }

  async findByCategory(
    tenantId: string,
    category: HealthCategory,
    includeInactive: boolean = false
  ): Promise<HealthTaxonomy[]> {
    const allRows = await this.categoryRepository.findAll(undefined, 'health' as any);
    let filteredRows = allRows;

    if (!includeInactive) {
      filteredRows = filteredRows.filter((row: any) => {
        const status = row.status;
        return status === 'active' || status === 'auto_active' || (status === null && true);
      });
    }

    const healthTaxonomies = filteredRows
      .map((row: any) => {
        const categoryModel = CategoryModel.fromRow(row);
        const taxonomy = this.toHealthTaxonomy({ ...categoryModel, metadata: row.metadata }, tenantId);
        return taxonomy;
      })
      .filter((t): t is HealthTaxonomy => t !== null && t.category === category);

    return healthTaxonomies.sort((a, b) => a.name.localeCompare(b.name));
  }

  async findBySlug(tenantId: string, slug: string): Promise<HealthTaxonomy | null> {
    const categoryRow = await this.categoryRepository.findBySlug(slug);
    if (!categoryRow) {
      return null;
    }
    const category = CategoryModel.fromRow(categoryRow);
    const taxonomy = this.toHealthTaxonomy({ ...category, metadata: (categoryRow as any).metadata }, tenantId);
    if (!taxonomy || !taxonomy.isActive) {
      return null;
    }
    return taxonomy;
  }

  async findById(tenantId: string, taxonomyId: string): Promise<HealthTaxonomy | null> {
    const categoryRow = await this.categoryRepository.findById(taxonomyId);
    if (!categoryRow) {
      return null;
    }
    const category = CategoryModel.fromRow(categoryRow);
    return this.toHealthTaxonomy({ ...category, metadata: (categoryRow as any).metadata }, tenantId);
  }

  async findByFactType(
    tenantId: string,
    factType: HealthFactType,
    includeInactive: boolean = false
  ): Promise<HealthTaxonomy[]> {
    const allRows = await this.categoryRepository.findAll(undefined, 'health' as any);
    let filteredRows = allRows;

    if (!includeInactive) {
      filteredRows = filteredRows.filter((row: any) => {
        const status = row.status;
        return status === 'active' || status === 'auto_active' || (status === null && true);
      });
    }

    const healthTaxonomies = filteredRows
      .map((row: any) => {
        const categoryModel = CategoryModel.fromRow(row);
        const taxonomy = this.toHealthTaxonomy({ ...categoryModel, metadata: row.metadata }, tenantId);
        return taxonomy;
      })
      .filter((t): t is HealthTaxonomy => t !== null && t.factType === factType);

    return healthTaxonomies.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export const profileHealthTaxonomyAdapter = new ProfileHealthTaxonomyAdapter();

