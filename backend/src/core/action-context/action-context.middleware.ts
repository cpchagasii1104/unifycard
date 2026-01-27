// backend/src/core/action-context/action-context.middleware.ts
// CONTINUOUS PRODUCTION: Action Context Middleware
// Obriga action_context em endpoints mutáveis

import { FastifyRequest, FastifyReply } from 'fastify';
import { socialPortsRegistry } from '@core/social/ports-registry';
import { runQueryWithTenant } from '@core/database/pool';
import { resolveGlobalUserId } from '@core/identity/identity.utils';

export interface ActionContext {
  actingUserId: string;
  actingActorId: string;
  authoritySource: 'ownership' | 'delegation' | 'system';
}

declare module 'fastify' {
  interface FastifyRequest {
    actionContext?: ActionContext;
  }
}

/**
 * Middleware que resolve e valida Action Context
 * 
 * Resolve:
 * - acting_user_id do auth (req.user.id)
 * - acting_actor_id de header x-acting-actor-id ou body actingActorId
 * - authority_source: ownership|delegation|system
 * 
 * Bloqueia endpoints mutáveis sem action_context
 */
export async function actionContextMiddleware(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Apenas aplicar em métodos mutáveis
  const isMutable = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!isMutable) {
    return; // Não bloquear GET/HEAD
  }

  // Verificar autenticação
  if (!req.user || !req.user.id) {
    return reply.status(401).send({ error: 'Authentication required' });
  }

  if (!req.tenant || !req.tenant.id) {
    return reply.status(400).send({ error: 'Tenant not found' });
  }

  const tenantId = req.tenant.id;
  const userId = req.user.id;

  // Resolver acting_actor_id
  let actingActorId: string | undefined;

  // 1. Tentar header x-acting-actor-id
  const headerActorId = req.headers['x-acting-actor-id'] as string;
  if (headerActorId) {
    actingActorId = headerActorId;
  }

  // 2. Tentar body actingActorId
  if (!actingActorId && req.body && typeof req.body === 'object') {
    const body = req.body as any;
    if (body.actingActorId) {
      actingActorId = body.actingActorId;
    }
  }

  // 3. Se não fornecido, usar actor do próprio user (default)
  if (!actingActorId) {
    const actorRepository = socialPortsRegistry.getActorRepository();
    const userActor = await actorRepository.findByUserId(tenantId, userId);
    if (userActor) {
      actingActorId = userActor.actor_id;
    } else {
      // Criar actor do user se não existir
      const actorRepository = socialPortsRegistry.getActorRepository();
      const newActor = await actorRepository.findOrCreateUserActor(tenantId, userId);
      actingActorId = newActor.actor_id;
    }
  }

  if (!actingActorId) {
    return reply.status(400).send({ error: 'Could not resolve acting actor' });
  }

  // 🔴 GARANTIA CANÔNICA: Verificar se actor existe E pertence ao tenant correto
  // Actor nunca existe fora de tenant válido - validação explícita de coerência
  const actorRepository = socialPortsRegistry.getActorRepository();
  const actor = await actorRepository.findById(tenantId, actingActorId);
  if (!actor) {
    return reply.status(404).send({ 
      error: 'Acting actor not found',
      details: {
        actingActorId,
        tenantId,
        reason: 'Actor não encontrado ou não pertence ao tenant'
      }
    });
  }
  
  // 🔴 VALIDAÇÃO EXPLÍCITA: Garantir que actor pertence ao tenant correto
  // Se actor foi encontrado mas não pertence ao tenant, é erro fatal
  // (findById já valida tenant, mas garantia explícita para clareza arquitetural)
  if (actor.tenant_id !== tenantId) {
    return reply.status(403).send({ 
      error: 'Actor tenant mismatch',
      details: {
        actingActorId,
        actorTenantId: actor.tenant_id,
        requestTenantId: tenantId,
        reason: 'Actor não pertence ao tenant da requisição'
      }
    });
  }

  // Verificar pré-condições básicas (ownership ou delegação ativa)
  // NÃO verificar permissão específica aqui - isso é responsabilidade dos guards
  let authoritySource: 'ownership' | 'delegation' | 'system' = 'system';
  
  // 1. Verificar ownership (user é o próprio actor)
  if (actor.actor_type === 'user' && actor.user_id === userId) {
    authoritySource = 'ownership';
  } else {
    // 2. Verificar delegação ativa (sem verificar permission específica)
    const userActor = await actorRepository.findByUserId(tenantId, userId);
    if (userActor) {
      const { actorDelegationRepository } = await import('../actor-delegation/actor-delegation.repository');
      const delegations = await actorDelegationRepository.findActiveByUserActor(
        tenantId,
        userActor.actor_id
      );
      
      const hasDelegation = delegations.some(
        (d) => d.institutionalActorId === actingActorId && d.status === 'active'
      );
      
      if (hasDelegation) {
        authoritySource = 'delegation';
      } else {
        // 3. Verificar ownership da entidade (para actors institucionais)
        const { actorRegistryService } = await import('../actor-registry/actor-registry.service');
        const registry = await actorRegistryService.findByActorId(tenantId, actingActorId);
        
        if (registry) {
          // Verificar ownership básico (sem permission específica)
          const isOwner = await checkBasicOwnership(tenantId, userId, registry.entityTable, registry.entityId);
          if (isOwner) {
            authoritySource = 'ownership';
          } else {
            // Se não tem ownership nem delegação, bloquear
            return reply.status(403).send({ 
              error: 'Not authorized to act as this actor',
              reason: 'No valid ownership or delegation found',
            });
          }
        } else {
          // Actor não está no registry e não é user do próprio userId
          return reply.status(403).send({ 
            error: 'Not authorized to act as this actor',
            reason: 'Actor not found in registry and no ownership',
          });
        }
      }
    } else {
      return reply.status(403).send({ 
        error: 'Not authorized to act as this actor',
        reason: 'User actor not found',
      });
    }
  }

  // Injetar action context no request
  req.actionContext = {
    actingUserId: userId,
    actingActorId,
    authoritySource,
  };

  // Adicionar ao body para uso posterior (se body existir)
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    (req.body as any).created_by_user_id = userId;
    (req.body as any).created_as_actor_id = actingActorId;
  }

  // Adicionar também como propriedades do request para acesso direto
  (req as any).created_by_user_id = userId;
  (req as any).created_as_actor_id = actingActorId;
}

/**
 * Verifica ownership básico (sem verificar permission específica)
 * Usado apenas para pré-condições no middleware
 */
async function checkBasicOwnership(
  tenantId: string,
  userId: string,
  entityTable: string,
  entityId: string
): Promise<boolean> {
  // Para companies: verificar se user é owner via company_users ou company_members
  if (entityTable === 'companies') {
    // Resolver global_user_id do userId
    const globalUserId = await resolveGlobalUserId(userId, tenantId);
    if (!globalUserId) {
      return false;
    }

    // Verificar company_users (legacy) - is_primary = true indica owner
    const companyUser = await runQueryWithTenant<{ global_user_id: string }>(
      tenantId,
      `
        SELECT global_user_id
        FROM company_users
        WHERE company_id = $1 AND global_user_id = $2 AND is_primary = true
        LIMIT 1
      `,
      [entityId, globalUserId]
    );

    if (companyUser && companyUser.length > 0) {
      return true;
    }

    // Verificar company_members (novo) - apenas se role = admin
    const { companyMembersRepository } = await import('../companies/company-members.repository');
    const members = await companyMembersRepository.find(tenantId, {
      companyId: entityId,
      role: 'admin' as any,
      status: 'active' as any,
    });

    // Verificar se algum membro admin é o user
    const { socialPortsRegistry } = await import('@core/social/ports-registry');
    const actorRepo = socialPortsRegistry.getActorRepository();
    for (const m of members) {
      const actor = await actorRepo.findById(tenantId, m.actorId);
      if (actor && actor.user_id === userId) {
        return true;
      }
    }
  }

  // Para groups: verificar owner_actor_id
  if (entityTable === 'groups') {
    const group = await runQueryWithTenant<{ owner_actor_id: string }>(
      tenantId,
      `
        SELECT owner_actor_id
        FROM groups
        WHERE group_id = $1
        LIMIT 1
      `,
      [entityId]
    );

    if (group && group.length > 0) {
      const { socialPortsRegistry } = await import('@core/social/ports-registry');
    const actorRepo = socialPortsRegistry.getActorRepository();
      const ownerActor = await actorRepo.findById(tenantId, group[0].owner_actor_id);
      if (ownerActor && ownerActor.user_id === userId) {
        return true;
      }
    }
  }

  // Para events: verificar actor_id do evento
  if (entityTable === 'events') {
    const event = await runQueryWithTenant<{ actor_id: string }>(
      tenantId,
      `
        SELECT actor_id
        FROM events
        WHERE id = $1
        LIMIT 1
      `,
      [entityId]
    );

    if (event && event.length > 0) {
      const { socialPortsRegistry } = await import('@core/social/ports-registry');
    const actorRepo = socialPortsRegistry.getActorRepository();
      const eventActor = await actorRepo.findById(tenantId, event[0].actor_id);
      if (eventActor && eventActor.user_id === userId) {
        return true;
      }
    }
  }

  return false;
}




