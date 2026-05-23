// src/core/instrumentation/metrics.routes.ts
//
// Rotas de métricas do sistema
// Expõe métricas básicas coletadas pelo plugin de instrumentação

import { FastifyPluginAsync } from 'fastify';
import { getMarketplaceStoreOnboardingMetricsSnapshot } from '@core/observability/marketplace-store-onboarding.observability';

const metricsRoutes: FastifyPluginAsync = async (fastify) => {
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
        storeOnboarding: getMarketplaceStoreOnboardingMetricsSnapshot(),
      };
    }

    const metrics = fastify.calculateMetrics();
    return {
      ...metrics,
      storeOnboarding: getMarketplaceStoreOnboardingMetricsSnapshot(),
    };
  });
};

export default metricsRoutes;
















