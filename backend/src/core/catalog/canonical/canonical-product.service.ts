// src/core/catalog/canonical/canonical-product.service.ts
// Serviço de produtos canônicos - READ-ONLY
// §5.2 / §5.3: apenas `CanonicalProductDbRowWithTimestamps` (snake) na fronteira PG; domínio = `CanonicalProduct` (camelCase).

import { runQueryWithTenant, runQueriesWithTenant } from '../../database/pool';
import { decisionLogService } from '../../decision-log/decision-log.service';
import type {
  CanonicalProduct,
  CanonicalProductSearchResult,
} from './canonical-product.types';
import type { CanonicalProductDbRowWithTimestamps } from './canonical-product-db.types';
import type { ConceptResolutionStatus } from './canonical-concept.types';
import {
  isCanonicalProductOperationalReady,
  sqlCanonicalIndustrialOperationalReady,
  sqlCanonicalIdMatchesTenantContext,
  sqlOrderScopedCanonicalFirst,
} from './canonical-product-readiness';

function normalizeCanonicalImages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((x): x is string => typeof x === 'string');
}


/**
 * Serviço de produtos canônicos
 * READ-ONLY: apenas busca e consulta, não cria ou altera produtos
 */
class CanonicalProductService {
  /**
   * Mapper explícito PG → domínio (§5.3).
   */
  private mapDbRowToCanonicalProduct(row: CanonicalProductDbRowWithTimestamps): CanonicalProduct {
    const rawAttrs = row.attributes;
    const attributes: Record<string, unknown> =
      rawAttrs && typeof rawAttrs === 'object' && !Array.isArray(rawAttrs)
        ? (rawAttrs as Record<string, unknown>)
        : {};
    const conceptResolutionStatus: ConceptResolutionStatus | undefined =
      row.concept_resolution_status != null && row.concept_resolution_status !== ''
        ? (row.concept_resolution_status as ConceptResolutionStatus)
        : undefined;
    const rowType = row.type || 'INDUSTRIAL';
    return {
      id: row.id,
      tenantId: row.tenant_id,
      gtin: row.gtin ?? '',
      name: row.name,
      brand: row.brand || undefined,
      images: normalizeCanonicalImages(row.images),
      attributes,
      categoryId: row.category_id || undefined,
      conceptId: row.concept_id || undefined,
      conceptResolutionStatus,
      type: 'INDUSTRIAL',
      operationalReady: isCanonicalProductOperationalReady({
        type: rowType,
        name: row.name,
        categoryId: row.category_id ?? null,
        conceptId: row.concept_id ?? null,
        conceptResolutionStatus: conceptResolutionStatus ?? 'unresolved',
        attributes: row.attributes,
      }),
      createdAt:
        row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt:
        row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  /**
   * Busca produtos canônicos
   * READ-ONLY: apenas consulta, não cria ou altera
   */
  async search(
    tenantId: string,
    query: string,
    options?: {
      categoryId?: string;
      brand?: string;
      limit?: number;
      offset?: number;
      /** Se true, inclui INDUSTRIAL ainda não operacionalmente prontos (backoffice). */
      includeNonReady?: boolean;
    }
  ): Promise<CanonicalProductSearchResult> {
    const { categoryId, brand, limit = 50, offset = 0, includeNonReady = false } = options || {};

    const searchTerm = `%${query}%`;

    const canVis = sqlCanonicalIdMatchesTenantContext('canonical_products', '$1::uuid');

    // Construir query de busca
    let sqlQuery = `
      SELECT id, tenant_id, gtin, name, brand, images, attributes, category_id, type, concept_id, concept_resolution_status, created_at, updated_at
      FROM canonical_products
      WHERE ${canVis}
        AND (
          name ILIKE $2
          OR brand ILIKE $2
          OR gtin IS NOT DISTINCT FROM $3::text
        )
    `;

    const params: any[] = [tenantId, searchTerm, query];

    // Adicionar filtros opcionais
    if (categoryId) {
      sqlQuery += ` AND category_id = $${params.length + 1}`;
      params.push(categoryId);
    }

    if (brand) {
      sqlQuery += ` AND brand ILIKE $${params.length + 1}`;
      params.push(`%${brand}%`);
    }

    if (!includeNonReady) {
      sqlQuery += ` AND ${sqlCanonicalIndustrialOperationalReady('canonical_products')}`;
    }

    // Ordenar por nome
    sqlQuery += ` ORDER BY name ASC`;

    // Paginação
    sqlQuery += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    // Executar busca
    const rows = await runQueriesWithTenant<CanonicalProductDbRowWithTimestamps>(
      tenantId,
      {
        text: sqlQuery,
        values: params,
      }
    );

    const products = rows.map((r) => this.mapDbRowToCanonicalProduct(r));

    // Contar total (sem paginação)
    let countQuery = `
      SELECT COUNT(*)::text AS count
      FROM canonical_products
      WHERE ${canVis}
        AND (
          name ILIKE $2
          OR brand ILIKE $2
          OR gtin IS NOT DISTINCT FROM $3::text
        )
    `;
    const countParams: any[] = [tenantId, searchTerm, query];

    if (categoryId) {
      countQuery += ` AND category_id = $${countParams.length + 1}`;
      countParams.push(categoryId);
    }

    if (brand) {
      countQuery += ` AND brand ILIKE $${countParams.length + 1}`;
      countParams.push(`%${brand}%`);
    }

    if (!includeNonReady) {
      countQuery += ` AND ${sqlCanonicalIndustrialOperationalReady('canonical_products')}`;
    }

    const totalRow = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: countQuery,
        values: countParams,
      }
    );

    const total = parseInt(totalRow?.count || '0', 10);

    const result: CanonicalProductSearchResult = {
      products,
      totalCents: total,
      query,
      filters: categoryId || brand ? { categoryId, brand } : undefined,
    };

    // Log estruturado de busca (observação)
    await this.logSearch(tenantId, query, result);

    return result;
  }

  /**
   * Busca produto canônico por GTIN
   */
  async findByGTIN(
    tenantId: string,
    gtin: string,
    options?: { includeNonReady?: boolean }
  ): Promise<CanonicalProduct | null> {
    const row = await runQueryWithTenant<CanonicalProductDbRowWithTimestamps>(
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
    const p = this.mapDbRowToCanonicalProduct(row);
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
    const row = await runQueryWithTenant<CanonicalProductDbRowWithTimestamps>(
      tenantId,
      {
        text: `
        SELECT id, tenant_id, gtin, name, brand, images, attributes, category_id, type, concept_id, concept_resolution_status, created_at, updated_at
        FROM canonical_products
        WHERE id = $2
          AND ${sqlCanonicalIdMatchesTenantContext('canonical_products', '$1::uuid')}
        LIMIT 1
        `,
        values: [tenantId, productId],
      }
    );

    if (!row) {
      return null;
    }
    const p = this.mapDbRowToCanonicalProduct(row);
    if (!options?.includeNonReady && !p.operationalReady) {
      return null;
    }
    return p;
  }

  /**
   * Busca produtos por categoria
   */
  async findByCategory(
    tenantId: string,
    categoryId: string,
    options?: {
      limit?: number;
      offset?: number;
      includeNonReady?: boolean;
    }
  ): Promise<CanonicalProductSearchResult> {
    const { limit = 50, offset = 0, includeNonReady = false } = options || {};

    const readyClause = includeNonReady ? '' : ` AND ${sqlCanonicalIndustrialOperationalReady('canonical_products')} `;

    const rows = await runQueriesWithTenant<CanonicalProductDbRowWithTimestamps>(
      tenantId,
      {
        text: `
        SELECT id, tenant_id, gtin, name, brand, images, attributes, category_id, type, concept_id, concept_resolution_status, created_at, updated_at
        FROM canonical_products
        WHERE ${sqlCanonicalIdMatchesTenantContext('canonical_products', '$1::uuid')}
          AND category_id = $2
        ${readyClause}
        ORDER BY name ASC
        LIMIT $3 OFFSET $4
        `,
        values: [tenantId, categoryId, limit, offset],
      }
    );

    const products = rows.map((r) => this.mapDbRowToCanonicalProduct(r));

    const totalRow = await runQueryWithTenant<{ count: string }>(
      tenantId,
      {
        text: `
        SELECT COUNT(*)::text AS count
        FROM canonical_products
        WHERE ${sqlCanonicalIdMatchesTenantContext('canonical_products', '$1::uuid')}
          AND category_id = $2
        ${readyClause}
        `,
        values: [tenantId, categoryId],
      }
    );

    const total = parseInt(totalRow?.count || '0', 10);

    return {
      products,
      totalCents: total,
      query: '',
      filters: { categoryId },
    };
  }

  /**
   * Log estruturado de busca (observação)
   */
  private async logSearch(
    tenantId: string,
    query: string,
    result: CanonicalProductSearchResult
  ): Promise<void> {
    // Log estruturado no console
    console.log(
      JSON.stringify({
        module: 'canonical-catalog',
        eventType: 'product_search',
        tenantId,
        query,
        filters: result.filters,
        resultsCount: result.products.length,
        totalResults: result.totalCents,
        timestamp: new Date().toISOString(),
      })
    );

    // Registrar no Decision Log (observação)
    try {
      await decisionLogService.createObservation(
        'economy',
        'canonical_product_search',
        {},
        0,
        {
          metadata: {
            query,
            filters: result.filters,
            resultsCount: result.products.length,
            totalResults: result.totalCents,
          },
        }
      );
    } catch (error) {
      // Não falhar silenciosamente - log o erro
      console.error(
        '[CanonicalProductService] Erro ao registrar busca no Decision Log:',
        error
      );
    }
  }
}

export const canonicalProductService = new CanonicalProductService();












