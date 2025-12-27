// src/plugins/tenant.plugin.ts
import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';

/**
 * Tenant Plugin
 *
 * Responsabilidade:
 *  - Ler o tenantId do request (header x-tenant-id)
 *  - Validar presença
 *  - Injetar em req.tenant.id
 *
 * Escopo:
 *  - Registrado apenas no bloco "protegido" no server.ts
 */
const tenantPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('tenant', null);

  fastify.addHook('preHandler', async (req) => {
    const rawTenantId = req.headers['x-tenant-id'];

    if (!rawTenantId || typeof rawTenantId !== 'string') {
      // 400 Bad Request - problema na requisição, não autenticação
      throw fastify.httpErrors.badRequest('Missing tenant ID in header x-tenant-id');
    }

    (req as any).tenant = { id: rawTenantId };
  });
};

export default fp(tenantPlugin, {
  name: 'tenant-plugin',
});
