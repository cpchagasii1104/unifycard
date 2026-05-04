// backend/src/modules/marketplace/product-price.repository.ts
// SPRINT 48: Repository para preços de produtos

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  ProductPrice,
  CreateProductPriceInput,
} from './pricing.types';

interface ProductPriceRow {
  id: string;
  tenant_id: string;
  product_variant_id: string;
  price_cents: string | number;
  currency: string;
  valid_from: Date;
  valid_to: Date | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

function rowToPriceCents(v: string | number): number {
  return typeof v === 'number' ? v : parseInt(String(v), 10);
}

class ProductPriceRepository {
  private toPrice(row: ProductPriceRow): ProductPrice {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      productVariantId: row.product_variant_id,
      priceCents: rowToPriceCents(row.price_cents),
      currency: row.currency,
      validFrom: row.valid_from,
      validTo: row.valid_to,
      metadata: row.metadata || null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async createPrice(
    tenantId: string,
    input: CreateProductPriceInput
  ): Promise<ProductPrice> {
    const row = await runQueryWithTenant<ProductPriceRow>(
      tenantId,
      `
      INSERT INTO product_prices (
        tenant_id, product_variant_id, price_cents, currency, valid_from, valid_to, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, tenant_id, product_variant_id, price_cents, currency, valid_from, valid_to,
                metadata, created_at, updated_at
      `,
      [
        tenantId,
        input.productVariantId,
        input.priceCents,
        input.currency || 'BRL',
        input.validFrom || new Date(),
        input.validTo || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar preço de produto');
    }

    return this.toPrice(row);
  }

  async getCurrentPrice(
    tenantId: string,
    variantId: string,
    date: Date = new Date()
  ): Promise<ProductPrice | null> {
    const row = await runQueryWithTenant<ProductPriceRow>(
      tenantId,
      `
      SELECT id, tenant_id, product_variant_id, price_cents, currency, valid_from, valid_to,
             metadata, created_at, updated_at
      FROM product_prices
      WHERE tenant_id = $1
        AND product_variant_id = $2
        AND valid_from <= $3
        AND (valid_to IS NULL OR valid_to > $3)
      ORDER BY valid_from DESC
      LIMIT 1
      `,
      [tenantId, variantId, date]
    );

    return row ? this.toPrice(row) : null;
  }

  async listPricesByVariant(
    tenantId: string,
    variantId: string
  ): Promise<ProductPrice[]> {
    const rows = await runQueriesWithTenant<ProductPriceRow>(
      tenantId,
      `
      SELECT id, tenant_id, product_variant_id, price_cents, currency, valid_from, valid_to,
             metadata, created_at, updated_at
      FROM product_prices
      WHERE tenant_id = $1 AND product_variant_id = $2
      ORDER BY valid_from DESC
      `,
      [tenantId, variantId]
    );

    return rows.map((row) => this.toPrice(row));
  }
}

export const productPriceRepository = new ProductPriceRepository();
