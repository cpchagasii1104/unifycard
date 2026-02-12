"use strict";
// src/modules/catalog/offer.service.ts
// Serviço de ofertas de produtos
Object.defineProperty(exports, "__esModule", { value: true });
exports.offerService = void 0;
const pool_1 = require("../../core/database/pool");
class OfferService {
    /**
     * Converte row do banco para ProductOffer
     */
    toProductOffer(row) {
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
    async listOffersByProduct(tenantId, productId, options) {
        const { regionId, cityId, activeOnly = true, limit = 50, offset = 0, } = options || {};
        let query = `
      SELECT id, tenant_id, product_id, merchant_id, price, stock, 
             location_region_id, location_city_id, active, createdAt, updatedAt
      FROM product_offers
      WHERE tenant_id = $1 AND product_id = $2
    `;
        const params = [tenantId, productId];
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
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, {
            text: query,
            values: params,
        });
        return rows.map((r) => this.toProductOffer(r));
    }
    /**
     * Busca oferta por ID
     */
    async findById(tenantId, offerId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, {
            text: `
        SELECT id, tenant_id, product_id, merchant_id, price, stock, 
               location_region_id, location_city_id, active, createdAt, updatedAt
        FROM product_offers
        WHERE tenant_id = $1 AND id = $2
        `,
            values: [tenantId, offerId],
        });
        return row ? this.toProductOffer(row) : null;
    }
}
exports.offerService = new OfferService();
