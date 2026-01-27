// src/core/profile/profile-health-taxonomy.repository.ts
// Repository para taxonomia de saúde (health_taxonomies)
// ADAPTER: Usa profileHealthTaxonomyAdapter que lê de categories (core)

import { profileHealthTaxonomyAdapter } from './profile-health-taxonomy-adapter';

export type HealthCategory = 'general' | 'vision' | 'dental' | 'medications' | 'mobility' | 'mental' | 'other';
export type HealthFactType = 'condition' | 'medication' | 'device' | 'service_need' | 'allergy' | 'other';

export interface HealthTaxonomy {
  taxonomyId: string;
  tenantId: string;
  name: string;
  slug: string;
  category: HealthCategory;
  factType: HealthFactType;
  parentId: string | null;
  description: string | null;
  metadata: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface HealthTaxonomyRow {
  taxonomy_id: string;
  tenant_id: string;
  name: string;
  slug: string;
  category: HealthCategory;
  fact_type: HealthFactType;
  parent_id: string | null;
  description: string | null;
  metadata: Record<string, any>;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class ProfileHealthTaxonomyRepository {
  async findByCategory(
    tenantId: string,
    category: HealthCategory,
    includeInactive: boolean = false
  ): Promise<HealthTaxonomy[]> {
    return profileHealthTaxonomyAdapter.findByCategory(tenantId, category, includeInactive);
  }

  async findBySlug(tenantId: string, slug: string): Promise<HealthTaxonomy | null> {
    return profileHealthTaxonomyAdapter.findBySlug(tenantId, slug);
  }

  async findById(tenantId: string, taxonomyId: string): Promise<HealthTaxonomy | null> {
    return profileHealthTaxonomyAdapter.findById(tenantId, taxonomyId);
  }

  async findByFactType(
    tenantId: string,
    factType: HealthFactType,
    includeInactive: boolean = false
  ): Promise<HealthTaxonomy[]> {
    return profileHealthTaxonomyAdapter.findByFactType(tenantId, factType, includeInactive);
  }
}

export const profileHealthTaxonomyRepository = new ProfileHealthTaxonomyRepository();





