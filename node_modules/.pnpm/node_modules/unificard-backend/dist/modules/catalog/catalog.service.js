"use strict";
// src/modules/catalog/catalog.service.ts
// Serviço de catálogo canônico
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogService = void 0;
const pool_1 = require("../../core/database/pool");
class CatalogService {
    /**
     * Converte row do banco para CanonicalProduct
     */
    toCanonicalProduct(row) {
        return {
            id: row.id,
            tenantId: row.tenant_id,
            gtin: row.gtin,
            name: row.name,
            brand: row.brand || undefined,
            images: row.images || [],
            attributes: row.attributes || {},
            categoryId: row.category_id || '',
            type: 'INDUSTRIAL',
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    /**
     * Converte row do banco para LocalProduct
     */
    toLocalProduct(row) {
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
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    /**
     * Busca produto canônico por GTIN
     */
    async findByGTIN(tenantId, gtin) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, {
            text: `
          SELECT id, tenant_id, gtin, name, brand, images, attributes, category_id, type, created_at, updated_at
          FROM canonical_products
          WHERE tenant_id = $1 AND gtin = $2
        `,
            values: [tenantId, gtin],
        });
        return row ? this.toCanonicalProduct(row) : null;
    }
    /**
     * Busca produto canônico por ID
     */
    async findById(tenantId, productId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, {
            text: `
          SELECT id, tenant_id, gtin, name, brand, images, attributes, category_id, type, created_at, updated_at
          FROM canonical_products
          WHERE tenant_id = $1 AND id = $2
        `,
            values: [tenantId, productId],
        });
        return row ? this.toCanonicalProduct(row) : null;
    }
    /**
     * Busca produtos no catálogo (canônicos + locais)
     * ⚠️ Importante: NÃO filtra por domain, taxonomy ou marketplace.
     * Categoria aqui é CANÔNICA.
     */
    async search(tenantId, query, options) {
        const { categoryId, type = 'ALL', limit = 50, offset = 0, } = options || {};
        const searchTerm = `%${query}%`;
        const canonicalProducts = [];
        const localProducts = [];
        // Produtos canônicos
        if (type === 'ALL' || type === 'INDUSTRIAL') {
            let canonicalQuery = `
        SELECT id, tenant_id, gtin, name, brand, images, attributes, category_id, type, created_at, updated_at
        FROM canonical_products
        WHERE tenant_id = $1
          AND (name ILIKE $2 OR brand ILIKE $2 OR gtin = $3)
      `;
            const params = [tenantId, searchTerm, query];
            if (categoryId) {
                canonicalQuery += ` AND category_id = $${params.length + 1}`;
                params.push(categoryId);
            }
            canonicalQuery += `
        ORDER BY name ASC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      `;
            params.push(limit, offset);
            const canonicalRows = await (0, pool_1.runQueriesWithTenant)(tenantId, { text: canonicalQuery, values: params });
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
            const params = [tenantId, searchTerm];
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
            const localRows = await (0, pool_1.runQueriesWithTenant)(tenantId, { text: localQuery, values: params });
            localProducts.push(...localRows.map(r => this.toLocalProduct(r)));
        }
        return {
            canonicalProducts,
            localProducts,
            offers: [],
            total: canonicalProducts.length + localProducts.length,
        };
    }
}
exports.catalogService = new CatalogService();
