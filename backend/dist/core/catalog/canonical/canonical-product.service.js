"use strict";
// src/core/catalog/canonical/canonical-product.service.ts
// Serviço de produtos canônicos - READ-ONLY
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalProductService = void 0;
const pool_1 = require("../../database/pool");
const decision_log_service_1 = require("../../decision-log/decision-log.service");
/**
 * Serviço de produtos canônicos
 * READ-ONLY: apenas busca e consulta, não cria ou altera produtos
 */
class CanonicalProductService {
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
            categoryId: row.category_id || undefined,
            type: 'INDUSTRIAL',
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    /**
     * Busca produtos canônicos
     * READ-ONLY: apenas consulta, não cria ou altera
     */
    async search(tenantId, query, options) {
        const { categoryId, brand, limit = 50, offset = 0 } = options || {};
        const searchTerm = `%${query}%`;
        // Construir query de busca
        let sqlQuery = `
      SELECT id, tenant_id, gtin, name, brand, images, attributes, category_id, type, created_at, updated_at
      FROM canonical_products
      WHERE tenant_id = $1
        AND (
          name ILIKE $2
          OR brand ILIKE $2
          OR gtin = $3
        )
    `;
        const params = [tenantId, searchTerm, query];
        // Adicionar filtros opcionais
        if (categoryId) {
            sqlQuery += ` AND category_id = $${params.length + 1}`;
            params.push(categoryId);
        }
        if (brand) {
            sqlQuery += ` AND brand ILIKE $${params.length + 1}`;
            params.push(`%${brand}%`);
        }
        // Ordenar por nome
        sqlQuery += ` ORDER BY name ASC`;
        // Paginação
        sqlQuery += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        // Executar busca
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, {
            text: sqlQuery,
            values: params,
        });
        const products = rows.map((r) => this.toCanonicalProduct(r));
        // Contar total (sem paginação)
        let countQuery = `
      SELECT COUNT(*)::text AS count
      FROM canonical_products
      WHERE tenant_id = $1
        AND (
          name ILIKE $2
          OR brand ILIKE $2
          OR gtin = $3
        )
    `;
        const countParams = [tenantId, searchTerm, query];
        if (categoryId) {
            countQuery += ` AND category_id = $${countParams.length + 1}`;
            countParams.push(categoryId);
        }
        if (brand) {
            countQuery += ` AND brand ILIKE $${countParams.length + 1}`;
            countParams.push(`%${brand}%`);
        }
        const totalRow = await (0, pool_1.runQueryWithTenant)(tenantId, {
            text: countQuery,
            values: countParams,
        });
        const total = parseInt(totalRow?.count || '0', 10);
        const result = {
            products,
            total,
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
    async findByGTIN(tenantId, gtin) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, {
            text: `
        SELECT id, tenant_id, gtin, name, brand, images, attributes, category_id, type, created_at, updated_at
        FROM canonical_products
        WHERE tenant_id = $1 AND gtin = $2
        LIMIT 1
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
        LIMIT 1
        `,
            values: [tenantId, productId],
        });
        return row ? this.toCanonicalProduct(row) : null;
    }
    /**
     * Busca produtos por categoria
     */
    async findByCategory(tenantId, categoryId, options) {
        const { limit = 50, offset = 0 } = options || {};
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, {
            text: `
        SELECT id, tenant_id, gtin, name, brand, images, attributes, category_id, type, created_at, updated_at
        FROM canonical_products
        WHERE tenant_id = $1 AND category_id = $2
        ORDER BY name ASC
        LIMIT $3 OFFSET $4
        `,
            values: [tenantId, categoryId, limit, offset],
        });
        const products = rows.map((r) => this.toCanonicalProduct(r));
        const totalRow = await (0, pool_1.runQueryWithTenant)(tenantId, {
            text: `
        SELECT COUNT(*)::text AS count
        FROM canonical_products
        WHERE tenant_id = $1 AND category_id = $2
        `,
            values: [tenantId, categoryId],
        });
        const total = parseInt(totalRow?.count || '0', 10);
        return {
            products,
            total,
            query: '',
            filters: { categoryId },
        };
    }
    /**
     * Log estruturado de busca (observação)
     */
    async logSearch(tenantId, query, result) {
        // Log estruturado no console
        console.log(JSON.stringify({
            module: 'canonical-catalog',
            eventType: 'product_search',
            tenantId,
            query,
            filters: result.filters,
            resultsCount: result.products.length,
            totalResults: result.total,
            timestamp: new Date().toISOString(),
        }));
        // Registrar no Decision Log (observação)
        try {
            await decision_log_service_1.decisionLogService.createObservation('economy', 'canonical_product_search', {}, 0, {
                metadata: {
                    query,
                    filters: result.filters,
                    resultsCount: result.products.length,
                    totalResults: result.total,
                },
            });
        }
        catch (error) {
            // Não falhar silenciosamente - log o erro
            console.error('[CanonicalProductService] Erro ao registrar busca no Decision Log:', error);
        }
    }
}
exports.canonicalProductService = new CanonicalProductService();
//# sourceMappingURL=canonical-product.service.js.map