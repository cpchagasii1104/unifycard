// src/plugins/rbac.plugin.ts
import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { rbacService } from '@core/rbac/rbac.service';
import type { PermissionString } from '@core/rbac/rbac.types';

declare module 'fastify' {
  interface FastifyInstance {
    requirePermission: (permissions: PermissionString[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAnyPermission: (permissions: PermissionString[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (roles: string[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * RBAC Plugin
 *
 * Fornece decorators para autorização em rotas:
 *  - requirePermission: usuário precisa de TODAS as permissions
 *  - requireAnyPermission: usuário precisa de pelo menos UMA permission
 *  - requireRole: usuário precisa de pelo menos UMA role
 */
const rbacPlugin: FastifyPluginAsync = async (fastify) => {
  // Decorator: requirePermission (TODAS)
  fastify.decorate('requirePermission', (permissions: PermissionString[]) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;

      if (!tenantId || !userId) {
        throw fastify.httpErrors.unauthorized('Authentication required');
      }

      const check = await rbacService.userHasAllPermissions(tenantId, userId, permissions);

      if (!check.hasPermission) {
        throw fastify.httpErrors.forbidden(
          check.reason || `Requires permissions: ${permissions.join(', ')}`
        );
      }
    };
  });

  // Decorator: requireAnyPermission (QUALQUER UMA)
  fastify.decorate('requireAnyPermission', (permissions: PermissionString[]) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;

      if (!tenantId || !userId) {
        throw fastify.httpErrors.unauthorized('Authentication required');
      }

      const check = await rbacService.userHasAnyPermission(tenantId, userId, permissions);

      if (!check.hasPermission) {
        throw fastify.httpErrors.forbidden(
          check.reason || `Requires at least one of: ${permissions.join(', ')}`
        );
      }
    };
  });

  // Decorator: requireRole (QUALQUER UMA)
  fastify.decorate('requireRole', (roles: string[]) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      const tenantId = req.tenant?.id;
      const userId = req.user?.id;

      if (!tenantId || !userId) {
        throw fastify.httpErrors.unauthorized('Authentication required');
      }

      const hasRole = await rbacService.userHasAnyRole(tenantId, userId, roles);

      if (!hasRole) {
        throw fastify.httpErrors.forbidden(`Requires one of roles: ${roles.join(', ')}`);
      }
    };
  });
};

export default fp(rbacPlugin, {
  name: 'rbac-plugin',
  dependencies: ['tenant-plugin', 'auth-plugin'],
});
