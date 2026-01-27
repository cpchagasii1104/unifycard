"use strict";
// src/modules/catalog/catalog.routes.ts
// Rotas READ-ONLY do catálogo canônico
Object.defineProperty(exports, "__esModule", { value: true });
const catalog_service_1 = require("./catalog.service");
const offer_service_1 = require("./offer.service");
const catalogRoutes = async (fastify) => {
    /**
     * GET /catalog/search?q=query&regionId=&type=
     * Busca produtos no catálogo (canônicos + locais)
     */
    fastify.get('/search', async (req, reply) => {
        const tenantId = req.tenant.id;
        const { q, regionId, cityId, categoryId, type, limit, offset } = req.query;
        if (!q || q.trim().length === 0) {
            return reply.status(400).send({
                error: 'Query parameter "q" is required',
            });
        }
        const result = await catalog_service_1.catalogService.search(tenantId, q.trim(), {
            regionId,
            cityId,
            categoryId,
            type: type || 'ALL',
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
        return reply.send(result);
    });
    /**
     * GET /catalog/product/:id
     * Busca produto canônico por ID
     */
    fastify.get('/product/:id', async (req, reply) => {
        const tenantId = req.tenant.id;
        const { id } = req.params;
        const product = await catalog_service_1.catalogService.findById(tenantId, id);
        if (!product) {
            return reply.status(404).send({
                error: 'Product not found',
            });
        }
        return reply.send(product);
    });
    /**
     * GET /catalog/product/:id/offers?regionId=&activeOnly=
     * Lista ofertas de um produto canônico
     */
    fastify.get('/product/:id/offers', async (req, reply) => {
        const tenantId = req.tenant.id;
        const { id } = req.params;
        const { regionId, cityId, activeOnly, limit, offset } = req.query;
        // Verificar se produto existe
        const product = await catalog_service_1.catalogService.findById(tenantId, id);
        if (!product) {
            return reply.status(404).send({
                error: 'Product not found',
            });
        }
        const offers = await offer_service_1.offerService.listOffersByProduct(tenantId, id, {
            regionId,
            cityId,
            activeOnly: activeOnly !== 'false',
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
        return reply.send({ offers });
    });
};
exports.default = catalogRoutes;
