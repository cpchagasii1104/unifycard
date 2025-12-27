"use strict";
// src/core/catalog/product-demand/product-demand.routes.ts
// Rotas READ-ONLY para sinal de demanda de produtos
Object.defineProperty(exports, "__esModule", { value: true });
const product_demand_service_1 = require("./product-demand.service");
const productDemandRoutes = async (fastify) => {
    /**
     * GET /catalog/product-demand/:cityId
     * Obtém sinais de demanda para todos os produtos de uma cidade
     * READ-ONLY: apenas observa e mede, não executa decisões
     */
    fastify.get('/:cityId', async (req, reply) => {
        const tenantId = req.tenant.id;
        const { cityId } = req.params;
        const result = await product_demand_service_1.productDemandService.getCityDemandSignals(tenantId, cityId);
        if (!result) {
            return reply.status(404).send({
                error: 'City not found',
            });
        }
        return reply.send(result);
    });
    /**
     * GET /catalog/product-demand/:cityId/:productId
     * Obtém sinal de demanda para um produto específico em uma cidade
     * READ-ONLY: apenas observa e mede, não executa decisões
     */
    fastify.get('/:cityId/:productId', async (req, reply) => {
        const tenantId = req.tenant.id;
        const { cityId, productId } = req.params;
        const signal = await product_demand_service_1.productDemandService.getProductDemandSignal(tenantId, cityId, productId);
        if (!signal) {
            return reply.status(404).send({
                error: 'City or product not found, or no offers for this product in this city',
            });
        }
        return reply.send(signal);
    });
};
exports.default = productDemandRoutes;
//# sourceMappingURL=product-demand.routes.js.map