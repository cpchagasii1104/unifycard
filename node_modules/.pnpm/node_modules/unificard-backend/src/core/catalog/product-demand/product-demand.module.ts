// src/core/catalog/product-demand/product-demand.module.ts
// Módulo de sinal de demanda de produtos - READ-ONLY

import { FastifyPluginAsync } from 'fastify';
import productDemandRoutes from './product-demand.routes';

const productDemandModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(productDemandRoutes);
};

export default productDemandModule;



