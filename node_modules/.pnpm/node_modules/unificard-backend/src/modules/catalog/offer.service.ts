// src/modules/catalog/offer.service.ts
// Serviço de ofertas de produtos

import { runQueryWithTenant, runQueriesWithTenant } from '../../core/database/pool';
import type { ProductOffer } from './catalog.types';

interface ProductOfferRow {
  id: string;
  tenant_id: string;
  product_id: string;
  merchant_id: string;
  price: string;
  stock: number | null;
  location_region_id: string | null;
  location_city_id: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

class OfferService {
  /**
   * Converte row do banco para ProductOffer
   */
  private toProductOffer(row: ProductOfferRow): ProductOffer {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      productId: row.product_id,
      merchantId: row.merchant_id,
      price: parseFloat(row.price),
      stock: row.stock || undefined,
      location: {
        regionId: row.location_region_id || undefined,
        cityId: row.location_city_id || undefined,
      },
      isActive: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Lista ofertas de um produto canônico
   */
  async listOffersByProduct(
    tenantId: string,
    productId: string,
    options?: {
      regionId?: string;
      cityId?: string;
      activeOnly?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<ProductOffer[]> {
    const {
      regionId,
      cityId,
      activeOnly = true,
      limit = 50,
      offset = 0,
    } = options || {};

    let query = `
      SELECT id, tenant_id, product_id, merchant_id, price, stock, 
             location_region_id, location_city_id, active, createdAt, updatedAt
      FROM product_offers
      WHERE tenant_id = $1 AND product_id = $2
    `;

    const params: any[] = [tenantId, productId];

    if (activeOnly) {
      query += ` AND active = TRUE`;
    }

    if (regionId) {
      query += ` AND location_region_id = $${params.length + 1}`;
      params.push(regionId);
    }

    if (cityId) {
      query += ` AND location_city_id = $${params.length + 1}`;
      params.push(cityId);
    }

    query += ` ORDER BY price ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const rows = await runQueriesWithTenant<ProductOfferRow>(tenantId, {
      text: query,
      values: params,
    });

    return rows.map((r) => this.toProductOffer(r));
  }

  /**
   * Busca oferta por ID
   */
  async findById(tenantId: string, offerId: string): Promise<ProductOffer | null> {
    const row = await runQueryWithTenant<ProductOfferRow>(
      tenantId,
      {
        text: `
        SELECT id, tenant_id, product_id, merchant_id, price, stock, 
               location_region_id, location_city_id, active, createdAt, updatedAt
        FROM product_offers
        WHERE tenant_id = $1 AND id = $2
        `,
        values: [tenantId, offerId],
      }
    );

    return row ? this.toProductOffer(row) : null;
  }
}

export const offerService = new OfferService();



