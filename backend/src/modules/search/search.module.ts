// backend/src/modules/search/search.module.ts
// Módulo de busca federada (omnibox) — F-GLOBAL-SEARCH-OMNI-SLICE-A.

import type { FastifyInstance } from 'fastify';
import searchOmniRoutes from './search-omni.routes';

const searchModule = async (fastify: FastifyInstance) => {
  await fastify.register(searchOmniRoutes);
};

export default searchModule;
