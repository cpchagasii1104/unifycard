// backend/src/modules/marketplace/product-attribute.repository.ts
// SPRINT 37.1: MARKETPLACE CORE - Catálogo Canônico
// Repository para atributos de produtos

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  ProductAttribute,
  CreateProductAttributeInput,
  UpdateProductAttributeInput,
  ListProductAttributesOptions,
} from './product-catalog.types';

interface ProductAttributeRow {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  data_type: string;
  unit: string | null;
  is_required: boolean;
  applies_to_category_id: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class ProductAttributeRepository {
  /**
   * Converte row para ProductAttribute
   */
  private toAttribute(row: ProductAttributeRow): ProductAttribute {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      slug: row.slug,
      dataType: row.data_type as any,
      unit: row.unit,
      isRequired: row.is_required,
      appliesToCategoryId: row.applies_to_category_id,
      metadata: row.metadata || null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Cria atributo
   */
  async createAttribute(
    tenantId: string,
    input: CreateProductAttributeInput
  ): Promise<ProductAttribute> {
    const row = await runQueryWithTenant<ProductAttributeRow>(
      tenantId,
      `
      INSERT INTO product_attributes (
        tenant_id, name, slug, data_type, unit, is_required,
        applies_to_category_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, tenant_id, name, slug, data_type, unit, is_required,
                applies_to_category_id, metadata, createdAt, updatedAt
      `,
      [
        tenantId,
        input.name,
        input.slug,
        input.dataType,
        input.unit || null,
        input.isRequired !== undefined ? input.isRequired : false,
        input.appliesToCategoryId || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar atributo');
    }

    return this.toAttribute(row);
  }

  /**
   * Busca atributo por ID
   */
  async getAttributeById(
    tenantId: string,
    attributeId: string
  ): Promise<ProductAttribute | null> {
    const row = await runQueryWithTenant<ProductAttributeRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, slug, data_type, unit, is_required,
             applies_to_category_id, metadata, createdAt, updatedAt
      FROM product_attributes
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, attributeId]
    );

    return row ? this.toAttribute(row) : null;
  }

  /**
   * Busca atributo por slug
   */
  async getAttributeBySlug(
    tenantId: string,
    slug: string
  ): Promise<ProductAttribute | null> {
    const row = await runQueryWithTenant<ProductAttributeRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, slug, data_type, unit, is_required,
             applies_to_category_id, metadata, createdAt, updatedAt
      FROM product_attributes
      WHERE tenant_id = $1 AND slug = $2
      LIMIT 1
      `,
      [tenantId, slug]
    );

    return row ? this.toAttribute(row) : null;
  }

  /**
   * Lista atributos
   */
  async listAttributes(
    tenantId: string,
    options: ListProductAttributesOptions = {}
  ): Promise<ProductAttribute[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (options.appliesToCategoryId !== undefined) {
      if (options.appliesToCategoryId === null) {
        conditions.push('applies_to_category_id IS NULL');
      } else {
        conditions.push(`applies_to_category_id = $${paramIndex}`);
        params.push(options.appliesToCategoryId);
        paramIndex++;
      }
    }

    if (options.dataType !== undefined) {
      conditions.push(`data_type = $${paramIndex}`);
      params.push(options.dataType);
      paramIndex++;
    }

    if (options.isRequired !== undefined) {
      conditions.push(`is_required = $${paramIndex}`);
      params.push(options.isRequired);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await runQueriesWithTenant<ProductAttributeRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, slug, data_type, unit, is_required,
             applies_to_category_id, metadata, createdAt, updatedAt
      FROM product_attributes
      ${whereClause}
      ORDER BY name ASC
      `,
      params
    );

    return rows.map((row) => this.toAttribute(row));
  }

  /**
   * Atualiza atributo
   */
  async updateAttribute(
    tenantId: string,
    attributeId: string,
    input: UpdateProductAttributeInput
  ): Promise<ProductAttribute> {
    const updates: string[] = [];
    const params: any[] = [tenantId, attributeId];
    let paramIndex = 3;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(input.name);
      paramIndex++;
    }

    if (input.slug !== undefined) {
      updates.push(`slug = $${paramIndex}`);
      params.push(input.slug);
      paramIndex++;
    }

    if (input.dataType !== undefined) {
      updates.push(`data_type = $${paramIndex}`);
      params.push(input.dataType);
      paramIndex++;
    }

    if (input.unit !== undefined) {
      updates.push(`unit = $${paramIndex}`);
      params.push(input.unit || null);
      paramIndex++;
    }

    if (input.isRequired !== undefined) {
      updates.push(`is_required = $${paramIndex}`);
      params.push(input.isRequired);
      paramIndex++;
    }

    if (input.appliesToCategoryId !== undefined) {
      updates.push(`applies_to_category_id = $${paramIndex}`);
      params.push(input.appliesToCategoryId || null);
      paramIndex++;
    }

    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(input.metadata));
      paramIndex++;
    }

    if (updates.length === 0) {
      // Nenhuma atualização, retornar atributo atual
      const attribute = await this.getAttributeById(tenantId, attributeId);
      if (!attribute) {
        throw new Error('Atributo não encontrado');
      }
      return attribute;
    }

    const setClause = updates.join(', ');

    const row = await runQueryWithTenant<ProductAttributeRow>(
      tenantId,
      `
      UPDATE product_attributes
      SET ${setClause}
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, name, slug, data_type, unit, is_required,
                applies_to_category_id, metadata, createdAt, updatedAt
      `,
      params
    );

    if (!row) {
      throw new Error('Atributo não encontrado');
    }

    return this.toAttribute(row);
  }

  /**
   * Busca atributos aplicáveis a uma categoria
   * Retorna atributos globais (applies_to_category_id IS NULL) + atributos específicos da categoria
   */
  async getAttributesForCategory(
    tenantId: string,
    categoryId: string
  ): Promise<ProductAttribute[]> {
    const rows = await runQueriesWithTenant<ProductAttributeRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, slug, data_type, unit, is_required,
             applies_to_category_id, metadata, createdAt, updatedAt
      FROM product_attributes
      WHERE tenant_id = $1
        AND (applies_to_category_id IS NULL OR applies_to_category_id = $2)
      ORDER BY name ASC
      `,
      [tenantId, categoryId]
    );

    return rows.map((row) => this.toAttribute(row));
  }
}

export const productAttributeRepository = new ProductAttributeRepository();









