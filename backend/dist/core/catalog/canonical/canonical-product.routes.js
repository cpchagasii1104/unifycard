"use strict";
// src/core/catalog/canonical/canonical-product.routes.ts
// Rotas READ-ONLY para catálogo canônico de produtos
Object.defineProperty(exports, "__esModule", { value: true });
const canonical_product_service_1 = require("./canonical-product.service");
const canonicalProductRoutes = async (fastify) => {
    /**
     * GET /catalog/products/search?q=query&categoryId=&brand=
     * Busca produtos canônicos
     * READ-ONLY: apenas consulta, não cria ou altera
     */
    fastify.get('/search', async (req, reply) => {
        const tenantId = req.tenant.id;
        const { q, categoryId, brand, limit, offset } = req.query;
        if (!q || q.trim().length === 0) {
            return reply.status(400).send({
                error: 'Query parameter "q" is required',
            });
        }
        const result = await canonical_product_service_1.canonicalProductService.search(tenantId, q.trim(), {
            categoryId,
            brand,
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
        return reply.send(result);
    });
    /**
     * GET /catalog/products/:id
     * Busca produto canônico por ID
     */
    fastify.get('/:id', async (req, reply) => {
        const tenantId = req.tenant.id;
        const { id } = req.params;
        const product = await canonical_product_service_1.canonicalProductService.findById(tenantId, id);
        if (!product) {
            return reply.status(404).send({
                error: 'Product not found',
            });
        }
        return reply.send(product);
    });
    /**
     * GET /catalog/products/gtin/:gtin
     * Busca produto canônico por GTIN
     */
    fastify.get('/gtin/:gtin', async (req, reply) => {
        const tenantId = req.tenant.id;
        const { gtin } = req.params;
        const product = await canonical_product_service_1.canonicalProductService.findByGTIN(tenantId, gtin);
        if (!product) {
            return reply.status(404).send({
                error: 'Product not found',
            });
        }
        return reply.send(product);
    });
    /**
     * GET /catalog/products/category/:categoryId
     * Busca produtos por categoria
     */
    fastify.get('/category/:categoryId', async (req, reply) => {
        const tenantId = req.tenant.id;
        const { categoryId } = req.params;
        const { limit, offset } = req.query;
        const result = await canonical_product_service_1.canonicalProductService.findByCategory(tenantId, categoryId, {
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
        return reply.send(result);
    });
};
exports.default = canonicalProductRoutes;
