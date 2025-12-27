"use strict";
// src/core/catalog/offer-index/offer-index.routes.ts
// Rotas READ-ONLY para índice de ofertas
Object.defineProperty(exports, "__esModule", { value: true });
const offer_index_service_1 = require("./offer-index.service");
const offerIndexRoutes = async (fastify) => {
    /**
     * GET /offers/search?productId=&cityId=&radiusKm=&lat=&lng=
     * Busca ofertas por produto e localização
     * READ-ONLY: apenas consulta, não cria ou altera
     */
    fastify.get('/search', async (req, reply) => {
        const tenantId = req.tenant.id;
        const { productId, cityId, radiusKm, lat, lng } = req.query;
        if (!productId) {
            return reply.status(400).send({
                error: 'Query parameter "productId" is required',
            });
        }
        const result = await offer_index_service_1.offerIndexService.search(tenantId, {
            productId,
            cityId,
            radiusKm: radiusKm ? parseFloat(radiusKm) : undefined,
            centerLat: lat ? parseFloat(lat) : undefined,
            centerLng: lng ? parseFloat(lng) : undefined,
        });
        return reply.send(result);
    });
    /**
     * GET /offers/merchant/:merchantId?productId=
     * Busca ofertas por merchant
     */
    fastify.get('/merchant/:merchantId', async (req, reply) => {
        const tenantId = req.tenant.id;
        const { merchantId } = req.params;
        const { productId, limit, offset } = req.query;
        const result = await offer_index_service_1.offerIndexService.findByMerchant(tenantId, merchantId, {
            productId,
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
        return reply.send(result);
    });
};
exports.default = offerIndexRoutes;
//# sourceMappingURL=offer-index.routes.js.map