// src/modules/catalog/catalog.service.ts
// Serviço de catálogo canônico

import { runQueryWithTenant, runQueriesWithTenant } from '../../core/database/pool';
import {
  isCanonicalProductOperationalReady,
  sqlCanonicalIndustrialOperationalReady,
  sqlCanonicalIdMatchesTenantContext,
  sqlOrderScopedCanonicalFirst,
} from '../../core/catalog/canonical/canonical-product-readiness';
import type {
  CanonicalProduct,
  LocalProduct,
  CatalogSearchResult,
} from './catalog.types';

interface CanonicalProductRow {
  id: string;
  tenant_id: string | null;
  gtin: string | null;
  name: string;
  brand: string | null;
  images: unknown;
  attributes: any;
  category_id: string | null;
  type: string;
  concept_id: string | null;
  concept_resolution_status: string | null;
  created_at: Date;
  updated_at: Date;
}

function normalizeCanonicalImagesCatalog(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((x): x is string => typeof x === 'string');
}

interface LocalProductRow {
  id: string;
  tenant_id: string;
  merchant_id: string;
  name: string;
  description: string | null;
  images: string[];
  attributes: any;
  category_id: string | null;
  type: string;
  created_at: Date;
  updated_at: Date;
}

class CatalogService {
  /**
   * Converte row do banco para CanonicalProduct
   */
  private toCanonicalProduct(row: CanonicalProductRow): CanonicalProduct {
    const crs = row.concept_resolution_status?.trim();
    const conceptResolutionStatus =
      crs === 'unresolved' || crs === 'auto_suggested' || crs === 'confirmed' ? crs : undefined;
    const rowType = row.type || 'INDUSTRIAL';
    return {
      id: row.id,
      tenantId: row.tenant_id,
      gtin: row.gtin ?? '',
      name: row.name,
      brand: row.brand || undefined,
      images: normalizeCanonicalImagesCatalog(row.images),
      attributes: row.attributes || {},
      categoryId: row.category_id || '',
      conceptId: row.concept_id || undefined,
      conceptResolutionStatus,
      type: 'INDUSTRIAL',
      operationalReady: isCanonicalProductOperationalReady({
        type: rowType,
        name: row.name,
        categoryId: row.category_id,
        conceptId: row.concept_id,
        conceptResolutionStatus: conceptResolutionStatus ?? 'unresolved',
        attributes: row.attributes,
      }),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Converte row do banco para LocalProduct
   */
  private toLocalProduct(row: LocalProductRow): LocalProduct {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      merchantId: row.merchant_id,
      name: row.name,
      description: row.description || undefined,
      images: row.images || [],
      attributes: row.attributes || {},
      categoryId: row.category_id || '',
      type: 'LOCAL',
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Busca produto canônico por GTIN
   */
  async findByGTIN(
    tenantId: string,
    gtin: string,
    options?: { includeNonReady?: boolean }
  ): Promise<CanonicalProduct | null> {
    const row = await runQueryWithTenant<CanonicalProductRow>(
      tenantId,
      {
        text: `
          SELECT id, tenant_id, gtin, name, brand, images, attributes, category_id, type, concept_id, concept_resolution_status, created_at, updated_at
          FROM canonical_products
          WHERE ${sqlCanonicalIdMatchesTenantContext('canonical_products', '$1::uuid')}
            AND gtin IS NOT DISTINCT FROM $2::text
          ORDER BY ${sqlOrderScopedCanonicalFirst('canonical_products')}, created_at ASC
          LIMIT 1
        `,
        values: [tenantId, gtin],
      }
    );

    if (!row) {
      return null;
    }
    const p = this.toCanonicalProduct(row);
    if (!options?.includeNonReady && !p.operationalReady) {
      return null;
    }
    return p;
  }

  /**
   * Busca produto canônico por ID
   */
  async findById(
    tenantId: string,
    productId: string,
    options?: { includeNonReady?: boolean }
  ): Promise<CanonicalProduct | null> {
    const row = await runQueryWithTenant<CanonicalProductRow>(
      tenantId,
      {
        text: `
          SELECT id, tenant_id, gtin, name, brand, images, attributes, category_id, type, concept_id, concept_resolution_status, created_at, updated_at
          FROM canonical_products
          WHERE id = $2
            AND ${sqlCanonicalIdMatchesTenantContext('canonical_products', '$1::uuid')}
        `,
        values: [tenantId, productId],
      }
    );

    if (!row) {
      return null;
    }
    const p = this.toCanonicalProduct(row);
    if (!options?.includeNonReady && !p.operationalReady) {
      return null;
    }
    return p;
  }

  /**
   * Busca produtos no catálogo (canônicos + locais)
   * ⚠️ Importante: NÃO filtra por domain, taxonomy ou marketplace.
   * Categoria aqui é CANÔNICA.
   */
  async search(
    tenantId: string,
    query: string,
    options?: {
      regionId?: string;
      cityId?: string;
      categoryId?: string;
      type?: 'INDUSTRIAL' | 'LOCAL' | 'ALL';
      limit?: number;
      offset?: number;
      includeNonReady?: boolean;
    }
  ): Promise<CatalogSearchResult> {
    const {
      categoryId,
      type = 'ALL',
      limit = 50,
      offset = 0,
      includeNonReady = false,
    } = options || {};

    const searchTerm = `%${query}%`;

    const canonicalProducts: CanonicalProduct[] = [];
    const localProducts: LocalProduct[] = [];

    // Produtos canônicos
    if (type === 'ALL' || type === 'INDUSTRIAL') {
      const canVis = sqlCanonicalIdMatchesTenantContext('canonical_products', '$1::uuid');
      let canonicalQuery = `
        SELECT id, tenant_id, gtin, name, brand, images, attributes, category_id, type, concept_id, concept_resolution_status, created_at, updated_at
        FROM canonical_products
        WHERE ${canVis}
          AND (name ILIKE $2 OR brand ILIKE $2 OR gtin IS NOT DISTINCT FROM $3::text)
      `;

      const params: any[] = [tenantId, searchTerm, query];

      if (categoryId) {
        canonicalQuery += ` AND category_id = $${params.length + 1}`;
        params.push(categoryId);
      }

      if (!includeNonReady) {
        canonicalQuery += ` AND ${sqlCanonicalIndustrialOperationalReady('canonical_products')}`;
      }

      canonicalQuery += `
        ORDER BY name ASC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      `;
      params.push(limit, offset);

      const canonicalRows = await runQueriesWithTenant<CanonicalProductRow>(
        tenantId,
        { text: canonicalQuery, values: params }
      );

      canonicalProducts.push(...canonicalRows.map(r => this.toCanonicalProduct(r)));
    }

    // Produtos locais
    if (type === 'ALL' || type === 'LOCAL') {
      let localQuery = `
        SELECT id, tenant_id, merchant_id, name, description, images, attributes, category_id, type, created_at, updated_at
        FROM local_products
        WHERE tenant_id = $1
          AND (name ILIKE $2 OR description ILIKE $2)
      `;

      const params: any[] = [tenantId, searchTerm];

      if (categoryId) {
        localQuery += ` AND category_id = $${params.length + 1}`;
        params.push(categoryId);
      }

      localQuery += `
        ORDER BY name ASC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      `;
      params.push(limit, offset);

      const localRows = await runQueriesWithTenant<LocalProductRow>(
        tenantId,
        { text: localQuery, values: params }
      );

      localProducts.push(...localRows.map(r => this.toLocalProduct(r)));
    }

    return {
      canonicalProducts,
      localProducts,
      offers: [],
      totalCents: canonicalProducts.length + localProducts.length,
    };
  }
}

export const catalogService = new CatalogService();



