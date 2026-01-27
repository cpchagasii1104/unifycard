// backend/src/modules/my-orders/my-orders.module.ts
// Módulo de My Orders & Purchases Hub

import type { FastifyInstance } from 'fastify';
import myOrdersRoutes from './my-orders.routes';

const myOrdersModule = async (fastify: FastifyInstance) => {
  await fastify.register(myOrdersRoutes, { prefix: '/api' });
};

export default myOrdersModule;




