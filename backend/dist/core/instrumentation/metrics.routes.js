"use strict";
// src/core/instrumentation/metrics.routes.ts
//
// Rotas de métricas do sistema
// Expõe métricas básicas coletadas pelo plugin de instrumentação
Object.defineProperty(exports, "__esModule", { value: true });
const metricsRoutes = async (fastify) => {
    /**
     * GET /metrics
     * Retorna métricas básicas do sistema
     */
    fastify.get('/', async () => {
        if (!fastify.calculateMetrics) {
            return {
                totalRequests: 0,
                totalErrors: 0,
                averageLatency: 0,
                maxLatency: 0,
                minLatency: 0,
            };
        }
        const metrics = fastify.calculateMetrics();
        return metrics;
    });
};
exports.default = metricsRoutes;
