// src/core/catalog/dynamic-pricing/dynamic-pricing.module.ts
// Módulo de simulação de preço dinâmico - READ-ONLY

import { FastifyPluginAsync } from 'fastify';
import dynamicPricingRoutes from './dynamic-pricing.routes';

const dynamicPricingModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(dynamicPricingRoutes);
};

export default dynamicPricingModule;



