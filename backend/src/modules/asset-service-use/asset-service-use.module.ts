// backend/src/modules/asset-service-use/asset-service-use.module.ts
// Módulo de USO OPERACIONAL asset-first — F-ASSET-MULTI-OFFER-FOUNDATION Fatia 4B (adendo
// RFC_ASSET_SERVICE_USE_OPERATIONAL_ADENDO). Domínio PRÓPRIO: NÃO dentro de services/asset-sale/rentals.

import type { FastifyInstance } from 'fastify';
import assetServiceUseRoutes from './asset-service-use.routes';

const assetServiceUseModule = async (fastify: FastifyInstance) => {
  await fastify.register(assetServiceUseRoutes, { prefix: '/asset-service-uses' });
};

export default assetServiceUseModule;
