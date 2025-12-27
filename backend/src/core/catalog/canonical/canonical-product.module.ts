// src/core/catalog/canonical/canonical-product.module.ts
// Módulo de catálogo canônico de produtos - READ-ONLY

import { FastifyPluginAsync } from 'fastify';
import canonicalProductRoutes from './canonical-product.routes';

const canonicalProductModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(canonicalProductRoutes);
};

export default canonicalProductModule;



