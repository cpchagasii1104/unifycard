// backend/src/modules/invoicing/invoice.module.ts
// Módulo de Invoice Engine

import type { FastifyInstance } from 'fastify';
import invoiceRoutes from './invoice.routes';

const invoiceModule = async (fastify: FastifyInstance) => {
  await fastify.register(invoiceRoutes, { prefix: '/api' });
};

export default invoiceModule;




