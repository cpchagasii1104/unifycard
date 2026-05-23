// backend/src/core/authorization/shadow-authorization.service.ts
// Shadow Authorization Service (Fase 2B)
// Calcula autorização usando actor_id + SSOT + RBAC corrigido
// SEM alterar comportamento de produção

import { runQueryWithTenant } from '@core/database/pool';
import { rbacService } from '../rbac/rbac.service';
import type { PermissionString } from '../rbac/rbac.types';
import type { PermissionKey } from './permission-keys';
import type { ShadowAuthResult, ShadowAuthReasonCode } from './shadow-auth.types';

class ShadowAuthorizationService {
  private readonly SHADOW_TIMEOUT_MS = 500;

  /**
   * Converte PermissionKey para formato resource:action
   * Se já estiver no formato, retorna como está
   * Se não, assume que o próprio permissionKey é o resource e action é 'execute'
   */
  private permissionKeyToResourceAction(permissionKey: PermissionKey): { resource: string; action: string } {
    if (permissionKey.includes(':')) {
      const [resource, action] = permissionKey.split(':');
      return { resource: resource || permissionKey, action: action || 'execute' };
    }
    // Para permissionKeys simples, usar o próprio key como resource
    return { resource: permissionKey, action: 'execute' };
  }

  /**
   * Calcula autorização shadow usando actor_id + SSOT + RBAC
   * Timeout hard de 500ms, erros nunca propagam
   */
  async calculateShadowAuthorization(
    tenantId: string,
    actorId: string,
    permissionKey: PermissionKey,
    scope?: string
  ): Promise<ShadowAuthResult | null> {
    // Timeout promise
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), this.SHADOW_TIMEOUT_MS);
    });

    // Calculation promise
    const calculationPromise = this.performShadowCalculation(tenantId, actorId, permissionKey, scope);

    // Race: timeout vs cálculo
    const result = await Promise.race([calculationPromise, timeoutPromise]);

    // Se timeout vencer, retorna null (não loga divergência)
    return result;
  }

  /**
   * Executa o cálculo shadow (ordem de verificação)
   */
  private async performShadowCalculation(
    tenantId: string,
    actorId: string,
    permissionKey: PermissionKey,
    scope?: string
  ): Promise<ShadowAuthResult> {
    // 1. Verificar Authority Roots (status constitucional)
    const rootStatus = await runQueryWithTenant<{ status: string }>(
      tenantId,
      `SELECT status FROM authority_roots WHERE actor_id = $1 LIMIT 1`,
      [actorId]
    );

    if (!rootStatus) {
      return {
        allowed: false,
        reasonCode: 'SSOT_ROOT_NOT_FOUND',
        reason: 'Actor not found in authority_roots',
      };
    }

    if (rootStatus.status !== 'active') {
      return {
        allowed: false,
        reasonCode: 'SSOT_ROOT_INACTIVE',
        reason: `Authority root status is ${rootStatus.status}`,
      };
    }

    // 2. Verificar Authority Trust Level (ATL)
    const atl = await runQueryWithTenant<{ atl_level: number; expires_at: string | null }>(
      tenantId,
      `SELECT atl_level, expires_at 
       FROM authority_trust_levels 
       WHERE actor_id = $1 
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY effective_at DESC 
       LIMIT 1`,
      [actorId]
    );

    if (atl) {
      // ATL nível 0 ou negativo bloqueia ações
      // ATL nível 1+ permite (níveis mais altos = mais confiança)
      if (atl.atl_level <= 0) {
        return {
          allowed: false,
          reasonCode: 'SSOT_ATL_BLOCKED',
          reason: `ATL level ${atl.atl_level} blocks action`,
        };
      }
    }

    // 3. Verificar Economic Guardianship (se aplicável - apenas informativo)
    const guardianship = await runQueryWithTenant<{
      guardian_actor_id: string;
      limit_amount_cents: number;
      expires_at: string;
    }>(
      tenantId,
      `SELECT guardian_actor_id, limit_amount_cents, expires_at
       FROM economic_guardianship
       WHERE subject_actor_id = $1
         AND expires_at > NOW()
       ORDER BY effective_at DESC 
       LIMIT 1`,
      [actorId]
    );

    // Guardianship não bloqueia por si só, apenas registra se existe
    const hasGuardianship = guardianship != null;

    // 4. Verificar Authority Delegations
    // NOTA: delegator_actor_id = quem concede, delegate_actor_id = quem tenta agir
    // Para verificar delegação, precisamos saber quem está delegando
    // Como não temos essa informação direta, vamos verificar se existe alguma delegação ativa
    // onde o actor_id é o delegate (quem recebeu a delegação)
    const delegation = await runQueryWithTenant<{
      delegator_actor_id: string;
      scope: string;
      expires_at: string;
      revoked_at: string | null;
    }>(
      tenantId,
      `SELECT delegator_actor_id, scope, expires_at, revoked_at
       FROM authority_delegations
       WHERE delegate_actor_id = $1
         AND expires_at > NOW()
         AND revoked_at IS NULL
       ORDER BY issued_at DESC 
       LIMIT 1`,
      [actorId]
    );

    // Se delegação existe e scope cobre permissão, permite
    if (delegation) {
      const delegationScope = delegation.scope;
      // Verificar se scope cobre a permissão (exato ou wildcard)
      if (delegationScope === '*' || delegationScope === permissionKey || delegationScope.includes(permissionKey)) {
        return {
          allowed: true,
          reasonCode: 'SSOT_DELEGATION_ALLOWED',
          reason: `Delegation from ${delegation.delegator_actor_id} covers permission`,
        };
      }
      // Delegação existe mas não cobre - continuar para RBAC
    }

    // 5. Verificar RBAC via função SQL (migration 989)
    const { resource, action } = this.permissionKeyToResourceAction(permissionKey);
    const intent = scope || tenantId; // Usar scope como intent, fallback para tenantId
    const rbacScope = scope || tenantId;

    try {
      const permissionString: PermissionString = `${resource}:${action}`;
      const rbacCheck = await rbacService.actorHasPermission(
        tenantId,
        actorId,
        intent,
        rbacScope,
        permissionString
      );

      if (!rbacCheck.hasPermission) {
        return {
          allowed: false,
          reasonCode: 'SSOT_RBAC_DENIED',
          reason: rbacCheck.reason || 'RBAC check failed',
        };
      }

      return {
        allowed: true,
        reasonCode: 'SSOT_RBAC_ALLOWED',
        reason: 'RBAC check passed',
      };
    } catch (error: any) {
      // Erro no RBAC - retornar deny por segurança
      return {
        allowed: false,
        reasonCode: 'SSOT_RBAC_DENIED',
        reason: `RBAC check error: ${error.message}`,
      };
    }
  }
}

export const shadowAuthorizationService = new ShadowAuthorizationService();

