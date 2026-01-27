// backend/src/modules/marketplace/product.repository.ts
// SPRINT 37.2: MARKETPLACE CORE - Produto & Variante
// Repository para produtos

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  Product,
  CreateProductInput,
  UpdateProductInput,
  ListProductsOptions,
} from './product-catalog.types';

interface ProductRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  category_id: string | null;
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
      productType: row.product_type as any,
      isActive: row.is_active,
      metadata: row.metadata || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Cria produto
   */
  async createProduct(
    tenantId: string,
    input: CreateProductInput
  ): Promise<Product> {
    const row = await runQueryWithTenant<ProductRow>(
      tenantId,
      `
      INSERT INTO products (
        tenant_id, name, description, category_id, product_type, is_active, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, tenant_id, name, description, category_id, product_type,
                is_active, metadata, created_at, updated_at
      `,
      [
        tenantId,
        input.name,
        input.description || null,
        input.categoryId || null,
        input.productType,
        input.isActive !== undefined ? input.isActive : true,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar produto');
    }

    return this.toProduct(row);
  }

  /**
   * Busca produto por ID
   */
  async getProductById(
    tenantId: string,
    productId: string
  ): Promise<Product | null> {
    const row = await runQueryWithTenant<ProductRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, description, category_id, product_type,
             is_active, metadata, created_at, updated_at
      FROM products
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, productId]
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await runQueriesWithTenant<ProductRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, description, category_id, product_type,
             is_active, metadata, created_at, updated_at
      FROM products
      ${whereClause}
      ORDER BY name ASC
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
      updates.push(`category_id = $${paramIndex}`);
      params.push(input.categoryId || null);
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
      const product = await this.getProductById(tenantId, productId);
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
      RETURNING id, tenant_id, name, description, category_id, product_type,
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







