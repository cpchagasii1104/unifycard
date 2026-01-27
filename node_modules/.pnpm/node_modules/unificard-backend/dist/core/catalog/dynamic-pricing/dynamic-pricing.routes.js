"use strict";
// src/core/catalog/dynamic-pricing/dynamic-pricing.routes.ts
// Rotas READ-ONLY para simulação de preço dinâmico
Object.defineProperty(exports, "__esModule", { value: true });
const dynamic_pricing_service_1 = require("./dynamic-pricing.service");
const dynamicPricingRoutes = async (fastify) => {
    /**
     * GET /catalog/dynamic-pricing/:cityId
     * Simula preços dinâmicos para todos os produtos de uma cidade
     * READ-ONLY: apenas simula, não executa mudanças
     */
    fastify.get('/:cityId', async (req, reply) => {
        const tenantId = req.tenant.id;
        const { cityId } = req.params;
        const result = await dynamic_pricing_service_1.dynamicPricingService.simulateCityDynamicPricing(tenantId, cityId);
        if (!result) {
            return reply.status(404).send({
                error: 'City not found or no products with offers',
            });
        }
        return reply.send(result);
    });
    /**
     * GET /catalog/dynamic-pricing/:cityId/:productId
     * Simula preço dinâmico para um produto específico
     * READ-ONLY: apenas simula, não executa mudanças
     */
    fastify.get('/:cityId/:productId', async (req, reply) => {
        const tenantId = req.tenant.id;
        const { cityId, productId } = req.params;
        const simulation = await dynamic_pricing_service_1.dynamicPricingService.simulateProductPricing(tenantId, cityId, productId);
        if (!simulation) {
            return reply.status(404).send({
                error: 'City, product not found, or no active offers for this product',
            });
        }
        return reply.send(simulation);
    });
};
exports.default = dynamicPricingRoutes;
