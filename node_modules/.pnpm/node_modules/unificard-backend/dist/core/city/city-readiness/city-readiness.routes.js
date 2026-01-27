"use strict";
// src/core/city/city-readiness/city-readiness.routes.ts
// Rotas READ-ONLY para verificação de prontidão de cidade
Object.defineProperty(exports, "__esModule", { value: true });
const city_readiness_service_1 = require("./city-readiness.service");
const cityReadinessRoutes = async (fastify) => {
    /**
     * GET /city-readiness/:cityId
     * Obtém prontidão de uma cidade
     * READ-ONLY: apenas diagnóstico, não executa nada
     */
    fastify.get('/:cityId', async (req, reply) => {
        const { cityId } = req.params;
        const result = await city_readiness_service_1.cityReadinessService.getCityReadiness(cityId);
        if (!result) {
            return reply.status(404).send({
                error: 'Cidade não encontrada',
            });
        }
        return reply.send(result);
    });
};
exports.default = cityReadinessRoutes;
