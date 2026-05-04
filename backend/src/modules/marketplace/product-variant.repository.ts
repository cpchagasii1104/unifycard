// backend/src/modules/marketplace/product-variant.repository.ts
// SPRINT 37.2: MARKETPLACE CORE - Produto & Variante
// Repository para variantes de produtos

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  ProductVariant,
  CreateProductVariantInput,
  UpdateProductVariantInput,
} from './product-catalog.types';

interface ProductVariantRow {
  id: string;
  tenant_id: string;
  product_id: string;
  sku: string;
  plu: string | null;
  attributes: any;
  is_active: boolean;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class ProductVariantRepository {
  /**
   * Converte row para ProductVariant
   */
  private toVariant(row: ProductVariantRow): ProductVariant {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      productId: row.product_id,
      sku: row.sku,
      plu: row.plu,
      attributes: row.attributes || null,
      isActive: row.is_active,
      metadata: row.metadata || null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Cria variante
   */
  async createVariant(
    tenantId: string,
    input: CreateProductVariantInput
  ): Promise<ProductVariant> {
    const row = await runQueryWithTenant<ProductVariantRow>(
      tenantId,
      `
      INSERT INTO product_variants (
        tenant_id, product_id, sku, plu, attributes, is_active, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, tenant_id, product_id, sku, plu, attributes, is_active,
                metadata, created_at, updated_at
      `,
      [
        tenantId,
        input.productId,
        input.sku,
        input.plu || null,
        JSON.stringify(input.attributes || {}),
        input.isActive !== undefined ? input.isActive : true,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar variante');
    }

    return this.toVariant(row);
  }

  /**
   * Busca variante por ID
   */
  async getVariantById(
    tenantId: string,
    variantId: string
  ): Promise<ProductVariant | null> {
    const row = await runQueryWithTenant<ProductVariantRow>(
      tenantId,
      `
      SELECT id, tenant_id, product_id, sku, plu, attributes, is_active,
             metadata, created_at, updated_at
      FROM product_variants
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, variantId]
    );

    return row ? this.toVariant(row) : null;
  }

  /**
   * Busca variante por SKU
   */
  async getVariantBySku(
    tenantId: string,
    sku: string
  ): Promise<ProductVariant | null> {
    const row = await runQueryWithTenant<ProductVariantRow>(
      tenantId,
      `
      SELECT id, tenant_id, product_id, sku, plu, attributes, is_active,
             metadata, created_at, updated_at
      FROM product_variants
      WHERE tenant_id = $1 AND sku = $2
      LIMIT 1
      `,
      [tenantId, sku]
    );

    return row ? this.toVariant(row) : null;
  }

  /**
   * Lista variantes de um produto
   */
  async listVariantsByProduct(
    tenantId: string,
    productId: string,
    includeInactive: boolean = false
  ): Promise<ProductVariant[]> {
    const conditions: string[] = ['tenant_id = $1', 'product_id = $2'];
    const params: any[] = [tenantId, productId];

    if (!includeInactive) {
      conditions.push('is_active = true');
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const rows = await runQueriesWithTenant<ProductVariantRow>(
      tenantId,
      `
      SELECT id, tenant_id, product_id, sku, plu, attributes, is_active,
             metadata, created_at, updated_at
      FROM product_variants
      ${whereClause}
      ORDER BY sku ASC
      `,
      params
    );

    return rows.map((row) => this.toVariant(row));
  }

  /**
   * Atualiza variante
   */
  async updateVariant(
    tenantId: string,
    variantId: string,
    input: UpdateProductVariantInput
  ): Promise<ProductVariant> {
    const updates: string[] = [];
    const params: any[] = [tenantId, variantId];
    let paramIndex = 3;

    if (input.sku !== undefined) {
      updates.push(`sku = $${paramIndex}`);
      params.push(input.sku);
      paramIndex++;
    }

    if (input.plu !== undefined) {
      updates.push(`plu = $${paramIndex}`);
      params.push(input.plu || null);
      paramIndex++;
    }

    if (input.attributes !== undefined) {
      updates.push(`attributes = $${paramIndex}`);
      params.push(JSON.stringify(input.attributes));
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
      // Nenhuma atualização, retornar variante atual
      const variant = await this.getVariantById(tenantId, variantId);
      if (!variant) {
        throw new Error('Variante não encontrada');
      }
      return variant;
    }

    const setClause = updates.join(', ');

    const row = await runQueryWithTenant<ProductVariantRow>(
      tenantId,
      `
      UPDATE product_variants
      SET ${setClause}
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, product_id, sku, plu, attributes, is_active,
                metadata, created_at, updated_at
      `,
      params
    );

    if (!row) {
      throw new Error('Variante não encontrada');
    }

    return this.toVariant(row);
  }
}

export const productVariantRepository = new ProductVariantRepository();



