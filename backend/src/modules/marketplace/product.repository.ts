// backend/src/modules/marketplace/product.repository.ts
// SPRINT 37.2: MARKETPLACE CORE - Produto & Variante
// Repository para produtos

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import {
  sqlCanonicalIndustrialOperationalReady,
  sqlCanonicalIdMatchesTenantContext,
} from '@core/catalog/canonical/canonical-product-readiness';
import type {
  Product,
  CreateProductInput,
  UpdateProductInput,
  ListProductsOptions,
} from './product-catalog.types';
import { assertProductConceptAllowedForTenant } from './product-concept-guard';

/**
 * P0 RFC 0: category_id obrigatório na criação de product (camada aplicação).
 * Mensagem e code padronizados para clientes/API.
 */
export function requireCategoryIdForProductCreate(
  categoryId: string | null | undefined
): string {
  if (typeof categoryId !== 'string' || categoryId.trim() === '') {
    const err = new Error('CATEGORY_REQUIRED');
    (err as { code?: string }).code = 'CATEGORY_REQUIRED';
    throw err;
  }
  return categoryId.trim();
}

/** `undefined` / `null` / string vazia → `NULL` na coluna `canonical_product_id`. */
export function normalizeCanonicalProductIdForDb(
  v: string | null | undefined
): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** Nome do índice único parcial em `backend/migrations/20260410140000_uidx_products_tenant_canonical.sql`. */
export const UIDX_PRODUCTS_TENANT_CANONICAL = 'uidx_products_tenant_canonical';

function isPgUniqueViolation(err: unknown): err is { code: string; constraint?: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}

function isTenantCanonicalUniqueViolation(err: unknown): boolean {
  return isPgUniqueViolation(err) && err.constraint === UIDX_PRODUCTS_TENANT_CANONICAL;
}

interface ProductRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  canonical_product_id: string | null;
  product_type: string;
  is_active: boolean;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class ProductRepository {
  /**
   * Converte row para Product
   */
  private toProduct(row: ProductRow): Product {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      categoryId: row.category_id,
      canonicalProductId: row.canonical_product_id ?? undefined,
      productType: row.product_type as any,
      isActive: row.is_active,
      metadata: row.metadata || null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Cria produto
   */
  async createProduct(
    tenantId: string,
    input: CreateProductInput
  ): Promise<Product> {
    const categoryId = requireCategoryIdForProductCreate(input.categoryId);
    const canonicalProductId = normalizeCanonicalProductIdForDb(input.canonicalProductId);

    await assertProductConceptAllowedForTenant(tenantId, canonicalProductId);

    try {
      const row = await runQueryWithTenant<ProductRow>(
        tenantId,
        `
      INSERT INTO products (
        tenant_id, name, description, category_id, canonical_product_id, product_type, is_active, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, tenant_id, name, description, category_id, canonical_product_id, product_type,
                is_active, metadata, created_at, updated_at
      `,
        [
          tenantId,
          input.name,
          input.description || null,
          categoryId,
          canonicalProductId,
          input.productType,
          input.isActive !== undefined ? input.isActive : true,
          JSON.stringify(input.metadata || {}),
        ]
      );

      if (!row) {
        throw new Error('Erro ao criar produto');
      }

      return this.toProduct(row);
    } catch (err) {
      if (
        canonicalProductId &&
        isTenantCanonicalUniqueViolation(err)
      ) {
        const existing = await this.getProductByCanonicalId(tenantId, canonicalProductId);
        if (existing) {
          return existing;
        }
      }
      throw err;
    }
  }

  /**
   * Busca produto por ID
   * @param options.includeNonReady — se true, devolve mesmo com canónico INDUSTRIAL não READY (gestão interna).
   */
  async getProductById(
    tenantId: string,
    productId: string,
    options?: { includeNonReady?: boolean }
  ): Promise<Product | null> {
    const row = await runQueryWithTenant<ProductRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, description, category_id, canonical_product_id, product_type,
             is_active, metadata, created_at, updated_at
      FROM products
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, productId]
    );

    if (!row) {
      return null;
    }
    const p = this.toProduct(row);
    if (options?.includeNonReady === true) {
      return p;
    }
    const cid = p.canonicalProductId;
    if (!cid) {
      return p;
    }
    const cpVis = sqlCanonicalIdMatchesTenantContext('cp', '$1::uuid');
    const ok = await runQueryWithTenant<{ one: number }>(
      tenantId,
      `
      SELECT 1 AS one
      FROM canonical_products cp
      WHERE cp.id = $2::uuid
        AND ${cpVis}
        AND ${sqlCanonicalIndustrialOperationalReady('cp')}
      LIMIT 1
      `,
      [tenantId, cid]
    );
    return ok ? p : null;
  }

  /**
   * Busca produto tenant por vínculo ao catálogo canónico (`canonical_product_id`).
   */
  async getProductByCanonicalId(
    tenantId: string,
    canonicalId: string
  ): Promise<Product | null> {
    const normalized = normalizeCanonicalProductIdForDb(canonicalId);
    if (!normalized) {
      return null;
    }

    const row = await runQueryWithTenant<ProductRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, description, category_id, canonical_product_id, product_type,
             is_active, metadata, created_at, updated_at
      FROM products
      WHERE tenant_id = $1 AND canonical_product_id = $2
      LIMIT 1
      `,
      [tenantId, normalized]
    );

    return row ? this.toProduct(row) : null;
  }

  /**
   * Lista produtos
   */
  async listProducts(
    tenantId: string,
    options: ListProductsOptions = {}
  ): Promise<Product[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (options.categoryId !== undefined) {
      if (options.categoryId === null) {
        conditions.push('category_id IS NULL');
      } else {
        conditions.push(`category_id = $${paramIndex}`);
        params.push(options.categoryId);
        paramIndex++;
      }
    }

    if (options.productType !== undefined) {
      conditions.push(`product_type = $${paramIndex}`);
      params.push(options.productType);
      paramIndex++;
    }

    if (options.isActive !== undefined && !options.includeInactive) {
      conditions.push(`is_active = $${paramIndex}`);
      params.push(options.isActive);
      paramIndex++;
    }

    if (options.includeNonReady !== true) {
      const cpVis = sqlCanonicalIdMatchesTenantContext('cp', 'products.tenant_id');
      conditions.push(`(
        products.canonical_product_id IS NULL
        OR EXISTS (
          SELECT 1 FROM canonical_products cp
          WHERE cp.id = products.canonical_product_id
            AND ${cpVis}
            AND ${sqlCanonicalIndustrialOperationalReady('cp')}
        )
      )`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await runQueriesWithTenant<ProductRow>(
      tenantId,
      `
      SELECT products.id, products.tenant_id, products.name, products.description, products.category_id,
             products.canonical_product_id, products.product_type,
             products.is_active, products.metadata, products.created_at, products.updated_at
      FROM products
      ${whereClause}
      ORDER BY products.name ASC
      `,
      params
    );

    return rows.map((row) => this.toProduct(row));
  }

  /**
   * Atualiza produto
   */
  async updateProduct(
    tenantId: string,
    productId: string,
    input: UpdateProductInput
  ): Promise<Product> {
    const updates: string[] = [];
    const params: any[] = [tenantId, productId];
    let paramIndex = 3;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(input.name);
      paramIndex++;
    }

    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(input.description || null);
      paramIndex++;
    }

    if (input.categoryId !== undefined) {
      const nextCategoryId = requireCategoryIdForProductCreate(input.categoryId);
      updates.push(`category_id = $${paramIndex}`);
      params.push(nextCategoryId);
      paramIndex++;
    }

    if (input.productType !== undefined) {
      updates.push(`product_type = $${paramIndex}`);
      params.push(input.productType);
      paramIndex++;
    }

    if (input.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      params.push(input.isActive);
      paramIndex++;
    }

    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(input.metadata));
      paramIndex++;
    }

    if (updates.length === 0) {
      // Nenhuma atualização, retornar produto atual
      const product = await this.getProductById(tenantId, productId, { includeNonReady: true });
      if (!product) {
        throw new Error('Produto não encontrado');
      }
      return product;
    }

    const setClause = updates.join(', ');

    const row = await runQueryWithTenant<ProductRow>(
      tenantId,
      `
      UPDATE products
      SET ${setClause}
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, name, description, category_id, canonical_product_id, product_type,
                is_active, metadata, created_at, updated_at
      `,
      params
    );

    if (!row) {
      throw new Error('Produto não encontrado');
    }

    return this.toProduct(row);
  }
}

export const productRepository = new ProductRepository();









