// backend/src/modules/business-audit/business-audit.module.ts
// Módulo de Auditoria de Negócio

import { FastifyPluginAsync } from 'fastify';
import businessAuditRoutes from './business-audit.routes';

const businessAuditModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(businessAuditRoutes);
};

export default businessAuditModule;




