// backend/src/core/authorization/authorization.service.ts
// CONTINUOUS PRODUCTION: Authorization Service Centralizado
// Centraliza lógica de permissões sem espalhar ifs

import { socialPortsRegistry } from '@core/social/ports-registry';
import { actorRegistryService } from '../actor-registry/actor-registry.service';
import { companyMembersRepository } from '../companies/company-members.repository';
import { actorDelegationRepository } from '../actor-delegation/actor-delegation.repository';
import { resolveGlobalUserId } from '@core/identity/identity.utils';
import { runQueryWithTenant } from '@core/database/pool';
import { canonicalLogger } from '@core/logging/canonical-logger';
import type { PermissionKey } from './permission-keys';
import { PERMISSION_CAPABILITIES, isValidPermissionKey } from './permission-keys';

export type AuthoritySource = 'ownership' | 'delegation' | 'system';

export interface AuthorizationResult {
  allowed: boolean;
  authoritySource?: AuthoritySource;
  reason?: string;
}

class AuthorizationService {
  /**
   * 🔴 GUARD CANÔNICO: Validação explícita de inputs críticos
   * Nenhuma resolução de permissão ocorre sem contexto completo e válido
   */
  private validateInputs(
    tenantId: string | undefined | null,
    userId: string | undefined | null,
    actorId: string | undefined | null,
    permissionKey: PermissionKey | undefined | null
  ): void {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new Error('PERMISSION_RESOLUTION_ERROR: tenantId is required and must be a non-empty string');
    }

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new Error('PERMISSION_RESOLUTION_ERROR: userId is required and must be a non-empty string');
    }

    if (!actorId || typeof actorId !== 'string' || actorId.trim() === '') {
      throw new Error('PERMISSION_RESOLUTION_ERROR: actorId is required and must be a non-empty string');
    }

    if (!permissionKey || typeof permissionKey !== 'string' || permissionKey.trim() === '') {
      throw new Error('PERMISSION_RESOLUTION_ERROR: permissionKey is required and must be a non-empty string');
    }

    if (!isValidPermissionKey(permissionKey)) {
      throw new Error(
        `PERMISSION_RESOLUTION_ERROR: permissionKey "${permissionKey}" is not defined in canonical map. ` +
        `See MAPA_CANONICO_PERMISSIONS_v1.md for valid permissions.`
      );
    }
  }

  /**
   * Verifica se user pode atuar como actor
   * 
   * 🔴 GARANTIAS CANÔNICAS:
   * - tenantId obrigatório (não-null, não-vazio)
   * - userId obrigatório (não-null, não-vazio)
   * - actorId obrigatório (não-null, não-vazio)
   * - permissionKey obrigatório e válido (deve existir no mapa canônico)
   * - Resolução determinística (mesmos inputs = mesmo resultado)
   * - Logs canônicos para todas as decisões de deny
   * 
   * Ordem de verificação:
   * 1. Ownership (user é o próprio actor ou owner da entidade)
   * 2. Delegation (user tem delegação ativa)
   * 3. System (capabilities do actor permitem)
   */
  async canActAs(
    tenantId: string,
    userId: string,
    actorId: string,
    permissionKey: PermissionKey,
    scope?: string
  ): Promise<AuthorizationResult> {
    // 🔴 GUARD CANÔNICO: Validar inputs críticos antes de qualquer resolução
    this.validateInputs(tenantId, userId, actorId, permissionKey);

    // 🔴 LOG CANÔNICO: Início da resolução (para observabilidade)
    canonicalLogger.debug(null, 'Iniciando resolução de permissão', {
      tenantId,
      userId,
      actorId,
      permissionKey,
      scope: scope || 'N/A',
    });

    // 1. Buscar actor
    const actorRepository = socialPortsRegistry.getActorRepository();
    const actor = await actorRepository.findById(tenantId, actorId);
    if (!actor) {
      const result: AuthorizationResult = { 
        allowed: false, 
        reason: 'Actor not found',
      };
      
      // 🔴 LOG CANÔNICO: Decisão de deny (actor não encontrado)
      canonicalLogger.authzDeny(null, 'Permissão negada: Actor não encontrado', {
        tenantId,
        userId,
        actorId,
        permissionKey,
        reason: result.reason,
      });
      
      return result;
    }

    // 2. Verificar ownership (user é o próprio actor)
    if (actor.actor_type === 'user' && actor.user_id === userId) {
      const result: AuthorizationResult = { 
        allowed: true, 
        authoritySource: 'ownership',
      };
      
      // 🔴 LOG CANÔNICO: Decisão de allow (ownership direto)
      canonicalLogger.authzAllow(null, 'Permissão concedida: Ownership direto', {
        tenantId,
        userId,
        actorId,
        permissionKey,
        authoritySource: result.authoritySource,
      });
      
      return result;
    }

    // 3. Verificar se é owner da entidade (para actors institucionais)
    const registry = await actorRegistryService.findByActorId(tenantId, actorId);
    if (registry) {
      const isOwner = await this.checkOwnership(tenantId, userId, registry.entityTable, registry.entityId);
      if (isOwner) {
        const result: AuthorizationResult = { 
          allowed: true, 
          authoritySource: 'ownership',
        };
        
        // 🔴 LOG CANÔNICO: Decisão de allow (ownership de entidade)
        canonicalLogger.authzAllow(null, 'Permissão concedida: Ownership de entidade', {
          tenantId,
          userId,
          actorId,
          permissionKey,
          entityTable: registry.entityTable,
          entityId: registry.entityId,
          authoritySource: result.authoritySource,
        });
        
        return result;
      }
    }

    // 4. Verificar delegação
    const delegation = await this.findActiveDelegation(tenantId, userId, actorId);
    if (delegation) {
      const hasPermission = this.checkDelegationPermission(delegation.scopes, permissionKey);
      if (hasPermission) {
        const result: AuthorizationResult = { 
          allowed: true, 
          authoritySource: 'delegation',
        };
        
        // 🔴 LOG CANÔNICO: Decisão de allow (delegação)
        canonicalLogger.authzAllow(null, 'Permissão concedida: Delegação', {
          tenantId,
          userId,
          actorId,
          permissionKey,
          delegationScopes: delegation.scopes,
          authoritySource: result.authoritySource,
        });
        
        return result;
      } else {
        // 🔴 LOG CANÔNICO: Delegação existe mas não cobre a permissão
        canonicalLogger.authzDeny(null, 'Delegação existe mas não cobre permissão', {
          tenantId,
          userId,
          actorId,
          permissionKey,
          delegationScopes: delegation.scopes,
        });
      }
    }

    // 5. Verificar capabilities do actor (system)
    if (registry) {
      const hasCapability = this.checkCapability(registry.capabilities, permissionKey);
      if (hasCapability) {
        // Mas user precisa ter acesso (ownership ou delegation)
        // Se chegou aqui, não tem acesso
        const result: AuthorizationResult = { 
          allowed: false, 
          reason: 'Actor has capability but user lacks access (no ownership or delegation)',
        };
        
        // 🔴 LOG CANÔNICO: Decisão de deny (capability sem acesso)
        canonicalLogger.authzDeny(null, 'Permissão negada: Capability sem acesso', {
          tenantId,
          userId,
          actorId,
          permissionKey,
          requiredCapability: PERMISSION_CAPABILITIES[permissionKey],
          actorCapabilities: registry.capabilities,
          reason: result.reason,
        });
        
        return result;
      }
    }

    // 🔴 LOG CANÔNICO: Decisão de deny (nenhuma autorização encontrada)
    const result: AuthorizationResult = { 
      allowed: false, 
      reason: 'No valid authorization found (checked: ownership, delegation, capabilities)',
    };
    
    canonicalLogger.authzDeny(null, 'Permissão negada: Nenhuma autorização válida', {
      tenantId,
      userId,
      actorId,
      permissionKey,
      actorType: actor.actor_type,
      hasRegistry: !!registry,
      hasDelegation: !!delegation,
      reason: result.reason,
    });
    
    return result;
  }

  /**
   * Verifica se user é owner da entidade
   */
  private async checkOwnership(
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
      const members = await companyMembersRepository.find(tenantId, {
        companyId: entityId,
        role: 'admin' as any,
        status: 'active' as any,
      });

      // Verificar se algum membro admin é o user
      for (const m of members) {
        const actorRepository = socialPortsRegistry.getActorRepository();
        const actor = await actorRepository.findById(tenantId, m.actorId);
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
        const actorRepository = socialPortsRegistry.getActorRepository();
        const ownerActor = await actorRepository.findById(tenantId, group[0].owner_actor_id);
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
        const actorRepository = socialPortsRegistry.getActorRepository();
        const eventActor = await actorRepository.findById(tenantId, event[0].actor_id);
        if (eventActor && eventActor.user_id === userId) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Busca delegação ativa
   */
  private async findActiveDelegation(
    tenantId: string,
    userId: string,
    actorId: string
  ): Promise<{ scopes: string[] } | null> {
    // Buscar actor do user
    const actorRepository = socialPortsRegistry.getActorRepository();
    const userActor = await actorRepository.findByUserId(tenantId, userId);
    if (!userActor) {
      return null;
    }

    // Buscar delegações ativas
    const delegations = await actorDelegationRepository.findActiveByUserActor(
      tenantId,
      userActor.actor_id
    );

    // Encontrar delegação para o actor específico
    const delegation = delegations.find((d) => d.institutionalActorId === actorId);
    if (!delegation) {
      return null;
    }

    return {
      scopes: delegation.scopes,
    };
  }

  /**
   * Verifica se delegação tem permissão
   */
  private checkDelegationPermission(scopes: string[], permissionKey: PermissionKey): boolean {
    return scopes.includes(permissionKey) || scopes.includes('*');
  }

  /**
   * Verifica se capability permite permissão
   * Usa PERMISSION_CAPABILITIES do mapa canônico
   */
  private checkCapability(capabilities: any, permissionKey: PermissionKey): boolean {
    const requiredCapability = PERMISSION_CAPABILITIES[permissionKey];
    
    // Se não requer capability específica, ownership/delegação é suficiente
    if (requiredCapability === null) {
      return true;
    }
    
    // Verificar se actor tem a capability requerida
    return capabilities?.[requiredCapability] === true;
  }
}

export const authorizationService = new AuthorizationService();




