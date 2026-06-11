// backend/src/core/authorization/authorization.service.ts
// CONTINUOUS PRODUCTION: Authorization Service Centralizado
// Centraliza lógica de permissões sem espalhar ifs

import { socialPortsRegistry } from '@core/social/ports-registry';
import { actorRegistryService, type ActorRegistryEntry } from '../actor-registry/actor-registry.service';
import { actorDelegationRepository } from '../actor-delegation/actor-delegation.repository';
import { resolveGlobalUserId } from '@core/identity/identity.utils';
import { runQueryWithTenant } from '@core/database/pool';
import { canonicalLogger } from '@core/logging/canonical-logger';
import type { PermissionKey } from './permission-keys';
import { PERMISSION_CAPABILITIES, isValidPermissionKey } from './permission-keys';
import { shadowAuthorizationService } from './shadow-authorization.service';
import type { ShadowAuthDivergenceLog } from './shadow-auth.types';

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
   * 3. Ramo legado: capability no registry sem vínculo → deny (não é allow implícito)
   *
   * Antes de qualquer `allowed: true`, se {@link PERMISSION_CAPABILITIES} exige string,
   * exige linha em `actor_registry` com `capabilities_json[cap] === true`.
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
      
      // 🔀 SHADOW AUTHORIZATION (Fase 2B) - Execução não-bloqueante
      this.calculateAndLogShadowDivergence(tenantId, userId, actorId, permissionKey, scope, result)
        .catch(() => {}); // Engolir erros silenciosamente
      
      return result;
    }

    const registry = await actorRegistryService.findByActorId(tenantId, actorId);

    // 2. Verificar ownership (user é o próprio actor)
    // Inclui actor_human / person (schema 0064) além do canónico 'user' (LEI §4.8.7).
    if (
      actor.user_id === userId &&
      (actor.actor_type === 'user' ||
        actor.actor_type === 'actor_human' ||
        actor.actor_type === 'person')
    ) {
      const capDeny = this.denyIfMissingRequiredRegistryCapability(permissionKey, registry);
      if (capDeny) {
        canonicalLogger.authzDeny(null, 'Permissão negada: capability obrigatória ausente no registry', {
          tenantId,
          userId,
          actorId,
          permissionKey,
          reason: capDeny.reason,
        });
        this.calculateAndLogShadowDivergence(tenantId, userId, actorId, permissionKey, scope, capDeny)
          .catch(() => {});
        return capDeny;
      }

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
      
      // 🔀 SHADOW AUTHORIZATION (Fase 2B) - Execução não-bloqueante
      this.calculateAndLogShadowDivergence(tenantId, userId, actorId, permissionKey, scope, result)
        .catch(() => {}); // Engolir erros silenciosamente
      
      return result;
    }

    // 3. Verificar se é owner da entidade (para actors institucionais)
    if (registry) {
      const isOwner = await this.checkOwnership(tenantId, userId, registry.entityTable, registry.entityId);
      if (isOwner) {
        const capDeny = this.denyIfMissingRequiredRegistryCapability(permissionKey, registry);
        if (capDeny) {
          canonicalLogger.authzDeny(null, 'Permissão negada: capability obrigatória ausente no registry', {
            tenantId,
            userId,
            actorId,
            permissionKey,
            reason: capDeny.reason,
          });
          this.calculateAndLogShadowDivergence(tenantId, userId, actorId, permissionKey, scope, capDeny)
            .catch(() => {});
          return capDeny;
        }

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
        
        // 🔀 SHADOW AUTHORIZATION (Fase 2B) - Execução não-bloqueante
        this.calculateAndLogShadowDivergence(tenantId, userId, actorId, permissionKey, scope, result)
          .catch(() => {}); // Engolir erros silenciosamente
        
        return result;
      }
    }

    // 4. Verificar delegação
    const delegation = await this.findActiveDelegation(tenantId, userId, actorId);
    if (delegation) {
      const hasPermission = this.checkDelegationPermission(delegation.scopes, permissionKey);
      if (hasPermission) {
        const capDeny = this.denyIfMissingRequiredRegistryCapability(permissionKey, registry);
        if (capDeny) {
          canonicalLogger.authzDeny(null, 'Permissão negada: capability obrigatória ausente no registry', {
            tenantId,
            userId,
            actorId,
            permissionKey,
            reason: capDeny.reason,
          });
          this.calculateAndLogShadowDivergence(tenantId, userId, actorId, permissionKey, scope, capDeny)
            .catch(() => {});
          return capDeny;
        }

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
        
        // 🔀 SHADOW AUTHORIZATION (Fase 2B) - Execução não-bloqueante
        this.calculateAndLogShadowDivergence(tenantId, userId, actorId, permissionKey, scope, result)
          .catch(() => {}); // Engolir erros silenciosamente
        
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
        
        // 🔀 SHADOW AUTHORIZATION (Fase 2B) - Execução não-bloqueante
        this.calculateAndLogShadowDivergence(tenantId, userId, actorId, permissionKey, scope, result)
          .catch(() => {}); // Engolir erros silenciosamente
        
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
    
    // 🔀 SHADOW AUTHORIZATION (Fase 2B) - Execução não-bloqueante
    this.calculateAndLogShadowDivergence(tenantId, userId, actorId, permissionKey, scope, result)
      .catch(() => {}); // Engolir erros silenciosamente
    
    return result;
  }

  /**
   * REPRESENTABILIDADE (DECISION-0113): "este `userId` pode VESTIR este `actorId`?"
   *
   * Primitivo **permission-agnóstico** e **registry-INDEPENDENTE**, distinto de `canActAs`
   * (que mistura representabilidade + autorização de uma `PermissionKey`). O RBAC (`rbac.plugin`)
   * precisa SÓ desta pergunta antes de decidir role/permission — `actionContext.actorId` é hint
   * não-soberano; a autoridade real exige que o principal autenticado possa representar o actor.
   *
   * Fontes (todas server-side, fail-closed):
   *  1. ownership direto — `actors.user_id === userId` (user/actor_human/person);
   *  2. empresa/page-actor — `actors.company_id → company_users` (via `checkOwnership('companies')`,
   *     **sem** depender de `actor_registry`, que é populado lazy — só em add-member);
   *  3. grupo — `actors.group_id → groups.owner_actor_id` (via `checkOwnership('groups')`);
   *  4. registry-bônus — se houver linha em `actor_registry`, `checkOwnership(entityTable,entityId)`
   *     cobre casos adicionais (ex.: events) quando o registro existir;
   *  5. delegação ativa — `actor_delegations` (via `findActiveDelegation`, já valida ativa/expira/revoga).
   *
   * NÃO decide role/permission/capability. NÃO infere actorId. Retorna apenas true/false.
   */
  async canRepresentActor(tenantId: string, userId: string, actorId: string): Promise<boolean> {
    // Inputs inválidos → fail-closed (deny).
    if (!tenantId?.trim() || !userId?.trim() || !actorId?.trim()) {
      return false;
    }

    const actorRepository = socialPortsRegistry.getActorRepository();
    const actor = await actorRepository.findById(tenantId, actorId);
    if (!actor) {
      return false; // actor inexistente no tenant → deny
    }

    // 1. Ownership direto (actor humano do próprio user) — registry-independente.
    if (
      actor.user_id === userId &&
      (actor.actor_type === 'user' ||
        actor.actor_type === 'actor_human' ||
        actor.actor_type === 'person')
    ) {
      return true;
    }

    // 2. Empresa / page-actor — registry-INDEPENDENTE, via o check CANÔNICO `canManageCompany`
    //    (`can_manage_company OR role='owner'`), NÃO o `checkOwnership` legado (que só vê
    //    `is_primary`/`role='admin'` e ignora o dono `role='owner'`). `resolveGlobalUserId` é
    //    fail-closed: principal desconhecido → null → deny.
    if (actor.company_id) {
      const globalUserId = await this.safeResolveGlobalUserId(userId, tenantId);
      if (globalUserId) {
        const { companiesService } = await import('@core/companies/companies.service');
        if (await companiesService.canManageCompany(tenantId, actor.company_id, globalUserId)) {
          return true;
        }
      }
    }

    // 3. Grupo — registry-INDEPENDENTE (actors.group_id → groups.owner_actor_id).
    if (actor.group_id && (await this.safeCheckOwnership(tenantId, userId, 'groups', actor.group_id))) {
      return true;
    }

    // 4. Registry-bônus: cobre entidades cujo vínculo não vive em coluna do actor (ex.: events),
    //    quando a linha de registry existir. Não é pré-requisito (2/3 já cobrem empresa/grupo).
    const registry = await actorRegistryService.findByActorId(tenantId, actorId);
    if (
      registry?.entityTable &&
      registry?.entityId &&
      (await this.safeCheckOwnership(tenantId, userId, registry.entityTable, registry.entityId))
    ) {
      return true;
    }

    // 5. Delegação ativa (não-expirada/não-revogada — garantido pelo repositório).
    if (await this.findActiveDelegation(tenantId, userId, actorId)) {
      return true;
    }

    return false;
  }

  /** resolveGlobalUserId fail-closed: principal desconhecido/erro → null (deny), nunca propaga. */
  private async safeResolveGlobalUserId(userId: string, tenantId: string): Promise<string | null> {
    try {
      return await resolveGlobalUserId(userId, tenantId);
    } catch {
      return null;
    }
  }

  /** checkOwnership fail-closed: qualquer erro de resolução → false (deny), nunca propaga. */
  private async safeCheckOwnership(
    tenantId: string,
    userId: string,
    entityTable: string,
    entityId: string
  ): Promise<boolean> {
    try {
      return await this.checkOwnership(tenantId, userId, entityTable, entityId);
    } catch {
      return false;
    }
  }

  /**
   * Se o mapa canónico exige capability em `actor_registry`, falha fechada sem linha ou sem flag `true`.
   */
  private denyIfMissingRequiredRegistryCapability(
    permissionKey: PermissionKey,
    registry: ActorRegistryEntry | null
  ): AuthorizationResult | null {
    const requiredCapability = PERMISSION_CAPABILITIES[permissionKey];
    if (requiredCapability === null || requiredCapability === undefined) {
      return null;
    }
    if (!registry || registry.capabilities?.[requiredCapability] !== true) {
      return {
        allowed: false,
        reason: 'Missing required capability',
      };
    }
    return null;
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

      // PJ-B4 (vocabulário alinhado): autoridade CANÔNICA de gestão primeiro —
      // can_manage_company OR role='owner', vínculo ativo (mesma semântica de
      // companiesService.canManageCompany). O helper legado abaixo (is_primary /
      // role='admin') é preservado de forma ADITIVA para não regredir grants existentes.
      const { companiesService } = await import('@core/companies/companies.service');
      if (await companiesService.canManageCompany(tenantId, entityId, globalUserId)) {
        return true;
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

      if (companyUser) {
        return true;
      }

      // DECISION-0042: company_users absorve role-based membership.
      // Verificar admin via company_users.role='admin' + member_status='active'.
      // Substitui consulta antiga a company_members (tabela inexistente em runtime).
      const adminMatch = await runQueryWithTenant<{ global_user_id: string }>(
        tenantId,
        `
          SELECT global_user_id
          FROM company_users
          WHERE company_id = $1
            AND global_user_id = $2
            AND role = 'admin'
            AND member_status = 'active'
          LIMIT 1
        `,
        [entityId, globalUserId]
      );

      if (adminMatch) {
        return true;
      }
    }

    // Para groups: verificar owner_actor_id
    if (entityTable === 'groups') {
      const group = await runQueryWithTenant<{ owner_actor_id: string }>(
        tenantId,
        `
          SELECT owner_actor_id
          FROM groups
          WHERE id = $1
          LIMIT 1
        `,
        [entityId]
      );

      if (group) {
        const actorRepository = socialPortsRegistry.getActorRepository();
        const ownerActor = await actorRepository.findById(tenantId, group.owner_actor_id);
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

      if (event) {
        const actorRepository = socialPortsRegistry.getActorRepository();
        const eventActor = await actorRepository.findById(tenantId, event.actor_id);
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

  /**
   * Calcula shadow authorization e loga divergência (Fase 2B)
   * Execução não-bloqueante, erros nunca propagam
   */
  private async calculateAndLogShadowDivergence(
    tenantId: string,
    userId: string,
    actorId: string,
    permissionKey: PermissionKey,
    scope: string | undefined,
    legacyResult: AuthorizationResult
  ): Promise<void> {
    try {
      const shadowResult = await shadowAuthorizationService.calculateShadowAuthorization(
        tenantId,
        actorId,
        permissionKey,
        scope
      );

      // Se timeout ou erro, não loga divergência
      if (!shadowResult) {
        return;
      }

      const decisionLegacy = legacyResult.allowed;
      const decisionShadow = shadowResult.allowed;

      // Logar APENAS quando há divergência real
      if (decisionLegacy !== decisionShadow) {
        const { resource, action } = this.permissionKeyToResourceAction(permissionKey);
        const reasonCode = decisionShadow
          ? 'SHADOW_ALLOW_LEGACY_DENY'
          : 'SHADOW_DENY_LEGACY_ALLOW';

        const logData: ShadowAuthDivergenceLog = {
          event: 'SHADOW_AUTH_DIVERGENCE',
          tenant_id: tenantId,
          actor_id: actorId,
          user_id: userId,
          permission_key: permissionKey,
          resource,
          action,
          decision_legacy: decisionLegacy,
          decision_shadow: decisionShadow,
          reason_code: reasonCode,
          shadow_reason: shadowResult.reason,
          timestamp: new Date().toISOString(),
        };

        canonicalLogger.shadowAuthDivergence(null, 'Divergência detectada entre shadow e legado', logData);
      }
    } catch (error) {
      // Engolir erro silenciosamente - nunca propagar
      // Shadow não pode afetar produção
    }
  }

  /**
   * Converte PermissionKey para formato resource:action
   * Helper para shadow authorization
   */
  private permissionKeyToResourceAction(permissionKey: PermissionKey): { resource: string; action: string } {
    if (permissionKey.includes(':')) {
      const [resource, action] = permissionKey.split(':');
      return { resource: resource || permissionKey, action: action || 'execute' };
    }
    return { resource: permissionKey, action: 'execute' };
  }
}

export const authorizationService = new AuthorizationService();




