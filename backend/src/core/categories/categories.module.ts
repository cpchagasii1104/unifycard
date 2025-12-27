// src/core/categories/categories.module.ts
import { FastifyPluginAsync } from 'fastify';
import categoriesRoutes from './categories.routes';

const categoriesModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(categoriesRoutes);
};

export default categoriesModule;








