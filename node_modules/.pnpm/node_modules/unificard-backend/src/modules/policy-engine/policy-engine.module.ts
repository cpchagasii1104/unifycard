// backend/src/modules/policy-engine/policy-engine.module.ts
// Módulo de Policy & Enforcement Engine

import type { FastifyInstance } from 'fastify';
import policyRoutes from './policy.routes';

const policyEngineModule = async (fastify: FastifyInstance) => {
  await fastify.register(policyRoutes, { prefix: '/api' });
};

export default policyEngineModule;




