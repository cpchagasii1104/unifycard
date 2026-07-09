// backend/src/modules/asset-sale/asset-sale.module.ts
// Módulo de VENDA asset-first — F-ASSET-MULTI-OFFER-FOUNDATION Fatia 3 (adendo RFC_ASSET_SALE_TERMS_ADENDO).
// Domínio PRÓPRIO (D-ζ): NÃO dentro de rentals, NÃO em product_offers.

import type { FastifyInstance } from 'fastify';
import assetSaleRoutes from './asset-sale.routes';

const assetSaleModule = async (fastify: FastifyInstance) => {
  await fastify.register(assetSaleRoutes, { prefix: '/asset-sales' });
};

export default assetSaleModule;
