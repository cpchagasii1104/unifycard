// backend/src/core/authorization/soft-block.service.ts
// Serviço centralizado de Soft-Block (Fase 3)
// Congelamento prospectivo de trilhos proibidos de autoridade

import { canonicalLogger } from '@core/logging/canonical-logger';
import { isSoftBlockEnabled } from './soft-block.config';
import { SoftBlockError } from './soft-block.errors';
import type { SoftBlockAttemptLog, SoftBlockMode, SoftBlockReasonCode } from './soft-block.types';

class SoftBlockService {
  /**
   * Flags de poder proibidas
   */
  private readonly PROHIBITED_FLAGS = [
    'can_manage_company',
    'can_manage_financial',
    'can_manage_employees',
    'can_manage_services',
  ];

  /**
   * Roles de poder proibidas em company_users
   */
  private readonly PROHIBITED_COMPANY_ROLES = [
    'owner',
    'director',
    'admin',
    'manager',
  ];

  /**
   * Capabilities de poder proibidas
   */
  private readonly PROHIBITED_CAPABILITIES = [
    'can_receive_funds',
    'can_publish_feed',
    'can_delegate',
    'can_hold_assets',
    'can_create_events',
    'can_manage_members',
  ];

  /**
   * Valida flags de poder (A)
   * Bloqueia CREATE com can_manage_* = true
   */
  validateFlags(flags: Record<string, boolean>, context: {
    tenantId: string;
    actorId?: string;
    userId?: string;
    requestId?: string;
  }): void {
    if (!isSoftBlockEnabled()) {
      return; // Comportamento legado
    }

    const prohibitedFlags = this.PROHIBITED_FLAGS.filter(flag => flags[flag] === true);
    
    if (prohibitedFlags.length > 0) {
      this.logAttempt('BLOCKED', 'flags', 'SOFT_BLOCK_PROHIBITED_FLAGS', context, {
        flags: prohibitedFlags,
      });
      
      throw new SoftBlockError('SOFT_BLOCK_PROHIBITED_FLAGS', {
        flags: prohibitedFlags,
      });
    }
  }

  /**
   * Valida role de company (B)
   * Bloqueia CREATE em company_users com roles de poder
   */
  validateCompanyRole(role: string, context: {
    tenantId: string;
    actorId?: string;
    userId?: string;
    requestId?: string;
  }): void {
    if (!isSoftBlockEnabled()) {
      return; // Comportamento legado
    }

    if (this.PROHIBITED_COMPANY_ROLES.includes(role.toLowerCase())) {
      this.logAttempt('BLOCKED', 'company_role', 'SOFT_BLOCK_PROHIBITED_COMPANY_ROLE', context, {
        role,
      });
      
      throw new SoftBlockError('SOFT_BLOCK_PROHIBITED_COMPANY_ROLE', {
        role,
      });
    }
  }

  /**
   * Valida capabilities JSON (C)
   * Bloqueia CREATE em actor_registry com capabilities de poder
   */
  validateCapabilities(capabilities: Record<string, any>, context: {
    tenantId: string;
    actorId?: string;
    userId?: string;
    requestId?: string;
  }): void {
    if (!isSoftBlockEnabled()) {
      return; // Comportamento legado
    }

    const prohibitedCapabilities = this.PROHIBITED_CAPABILITIES.filter(
      cap => capabilities[cap] === true
    );
    
    if (prohibitedCapabilities.length > 0) {
      this.logAttempt('BLOCKED', 'capabilities_json', 'SOFT_BLOCK_PROHIBITED_CAPABILITIES', context, {
        capabilities: prohibitedCapabilities,
      });
      
      throw new SoftBlockError('SOFT_BLOCK_PROHIBITED_CAPABILITIES', {
        capabilities: prohibitedCapabilities,
      });
    }
  }

  /**
   * Valida delegação (D)
   * Bloqueia CREATE em actor_delegations com problemas
   */
  validateDelegation(input: {
    isTransitive?: boolean;
    expiresAt?: Date | null;
    scopes?: string[];
  }, context: {
    tenantId: string;
    actorId?: string;
    userId?: string;
    requestId?: string;
  }): void {
    if (!isSoftBlockEnabled()) {
      return; // Comportamento legado
    }

    // Delegação transitiva
    if (input.isTransitive === true) {
      this.logAttempt('BLOCKED', 'actor_delegations', 'SOFT_BLOCK_TRANSITIVE_DELEGATION', context);
      throw new SoftBlockError('SOFT_BLOCK_TRANSITIVE_DELEGATION');
    }

    // Sem expires_at
    if (!input.expiresAt) {
      this.logAttempt('BLOCKED', 'actor_delegations', 'SOFT_BLOCK_DELEGATION_WITHOUT_EXPIRY', context);
      throw new SoftBlockError('SOFT_BLOCK_DELEGATION_WITHOUT_EXPIRY');
    }

    // Sem escopo explícito ou wildcard
    if (!input.scopes || input.scopes.length === 0) {
      this.logAttempt('BLOCKED', 'actor_delegations', 'SOFT_BLOCK_DELEGATION_WITHOUT_SCOPE', context);
      throw new SoftBlockError('SOFT_BLOCK_DELEGATION_WITHOUT_SCOPE');
    }

    if (input.scopes.includes('*')) {
      this.logAttempt('BLOCKED', 'actor_delegations', 'SOFT_BLOCK_DELEGATION_WILDCARD_SCOPE', context);
      throw new SoftBlockError('SOFT_BLOCK_DELEGATION_WILDCARD_SCOPE');
    }
  }

  /**
   * Loga atribuição de role RBAC (E - LOG ONLY)
   * Não bloqueia, apenas loga
   */
  logRbacRoleAssignment(roleId: string, roleName: string, context: {
    tenantId: string;
    actorId?: string;
    userId?: string;
    requestId?: string;
  }): void {
    if (!isSoftBlockEnabled()) {
      return; // Não loga se soft-block desabilitado
    }

    // Verificar se é role de poder (admin, etc)
    const isPowerRole = roleName.toLowerCase().includes('admin') || 
                       roleName.toLowerCase().includes('owner') ||
                       roleName.toLowerCase().includes('director');

    if (isPowerRole) {
      this.logAttempt('LOG_ONLY', 'user_roles', 'LOG_ONLY_RBAC_ROLE_ASSIGNMENT', context, {
        roleId,
        roleName,
      });
    }
  }

  /**
   * Loga update de capabilities (F - LOG ONLY)
   * Não bloqueia, apenas loga se aumentar poder
   */
  logCapabilitiesUpdate(
    oldCapabilities: Record<string, any>,
    newCapabilities: Record<string, any>,
    context: {
      tenantId: string;
      actorId?: string;
      userId?: string;
      requestId?: string;
    }
  ): void {
    if (!isSoftBlockEnabled()) {
      return; // Não loga se soft-block desabilitado
    }

    // Verificar se novas capabilities aumentam poder
    const newPowerCapabilities = this.PROHIBITED_CAPABILITIES.filter(
      cap => !oldCapabilities[cap] && newCapabilities[cap] === true
    );

    if (newPowerCapabilities.length > 0) {
      this.logAttempt('LOG_ONLY', 'capabilities_json', 'LOG_ONLY_CAPABILITIES_UPDATE', context, {
        addedCapabilities: newPowerCapabilities,
      });
    }
  }

  /**
   * Loga tentativa de criação bloqueada ou log-only
   */
  private logAttempt(
    mode: SoftBlockMode,
    sourceTrilho: string,
    reasonCode: SoftBlockReasonCode,
    context: {
      tenantId: string;
      actorId?: string;
      userId?: string;
      requestId?: string;
    },
    details?: Record<string, any>
  ): void {
    const logData: SoftBlockAttemptLog = {
      event: 'SOFT_BLOCK_AUTHORITY_ATTEMPT',
      mode,
      tenant_id: context.tenantId,
      actor_id: context.actorId,
      user_id: context.userId,
      source_trilho: sourceTrilho,
      reason_code: reasonCode,
      request_id: context.requestId,
      timestamp: new Date().toISOString(),
      details,
    };

    canonicalLogger.warn(null, `Soft-Block ${mode}: ${reasonCode}`, logData);
  }
}

export const softBlockService = new SoftBlockService();




