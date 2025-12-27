// src/core/companies/companies.module.ts
// Módulo de empresas (PJ)

import { FastifyPluginAsync } from 'fastify';
import companiesRoutes from './companies.routes';

const companiesModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(companiesRoutes);
};

export default companiesModule;


