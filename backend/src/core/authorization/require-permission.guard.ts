// backend/src/core/authorization/require-permission.guard.ts
// CONTINUOUS PRODUCTION: Permission Guard Factory
// Guard específico para verificação de permissões em rotas

import { FastifyRequest, FastifyReply } from 'fastify';
import type { PermissionKey } from './permission-keys';
import { PERMISSION_CAPABILITIES, isValidPermissionKey } from './permission-keys';

/**
 * Factory que retorna um guard específico para uma permissão
 * 
 * Uso:
 * ```ts
 * fastify.post('/posts', {
 *   preHandler: [requirePermission('publish_feed')]
 * }, handler);
 * ```
 */
export function requirePermission(
  permissionKey: PermissionKey,
  opts?: { capability?: string }
) {
  // BLOQUEIO: Validar que permission existe no mapa canônico
  if (!isValidPermissionKey(permissionKey)) {
    throw new Error(
      `Permission "${permissionKey}" not defined in canonical map v1.3. ` +
      `See MAPA_CANONICO_PERMISSIONS_v1.md for valid permissions.`
    );
  }

  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Verificar se action context existe (deve ter sido resolvido pelo middleware)
    const actionContext = (req as any).actionContext;
    if (!actionContext) {
      return reply.status(400).send({ 
        error: 'Action context not found',
        hint: 'Action context middleware must run before permission guard'
      });
    }

    if (!req.tenant || !req.tenant.id) {
      return reply.status(400).send({ error: 'Tenant not found' });
    }

    const tenantId = req.tenant.id;
    // ActionContext é obrigatório (V2) - usar apenas actorId
    const actorId = actionContext.actorId;
    const userId = (req as { user?: { id?: string } }).user?.id;
    if (!userId) {
      return reply.status(401).send({
        error: 'Authentication required',
        hint: 'Permission guard requires an authenticated user (req.user.id)',
      });
    }

    // Verificar capability requerida pelo mapa canônico
    const requiredCapability = PERMISSION_CAPABILITIES[permissionKey];
    
    if (requiredCapability !== null) {
      // Verificar se actor tem a capability requerida
      const { actorRegistryService } = await import('../actor-registry/actor-registry.service');
      const registry = await actorRegistryService.findByActorId(tenantId, actorId);
      
      if (registry && !registry.capabilities[requiredCapability]) {
        return reply.status(403).send({
          error: `Capability denied: ${requiredCapability}`,
          reason: `Permission "${permissionKey}" requires capability "${requiredCapability}" which actor does not have`,
          actorId,
          permissionKey,
          requiredCapability,
        });
      }
    }

    // Permissão canónica + quarentena §4.8.4: delegar na fachada modules (N3)
    const { authorityService } = await import('@modules/authority/authority.service');
    const authResult = await authorityService.canPerformAction(
      actorId,
      permissionKey,
      undefined,
      {
        tenantId,
        userId,
        scope: actionContext.scope,
      }
    );

    if (!authResult.allowed) {
      return reply.status(403).send({
        error: `Permission denied: ${permissionKey}`,
        reason: authResult.reason,
        actorId,
        permissionKey,
      });
    }

    // Verificar capability adicional se especificada manualmente (override)
    if (opts?.capability) {
      const { actorRegistryService } = await import('../actor-registry/actor-registry.service');
      const registry = await actorRegistryService.findByActorId(tenantId, actorId);
      
      if (registry && !registry.capabilities[opts.capability]) {
        return reply.status(403).send({
          error: `Capability denied: ${opts.capability}`,
          reason: `Actor does not have capability ${opts.capability}`,
          actorId,
          capability: opts.capability,
        });
      }
    }
  };
}








