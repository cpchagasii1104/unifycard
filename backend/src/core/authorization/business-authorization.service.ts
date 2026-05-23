// backend/src/core/authorization/business-authorization.service.ts
// Service de Validação de Permissões para Ações Críticas
// 🔴 BLINDAGEM: Backend é fonte única de verdade
// 🔴 BLINDAGEM: NÃO confiar no frontend
//
// 🔴 LEGACY — NÃO USAR COMO DECISÃO FINAL
// Este service foi rebaixado para LEGACY / helper de dados.
// Métodos que retornam allowed/denied NÃO DEVEM ser usados como decisão.
// A decisão final DEVE passar por authorization.service.canActAs().
// Este service existe apenas para compatibilidade e leitura de dados (roles).
// Camadas e sobreposição com PermissionKey: ver AUTHORITY_LAYERS.md nesta pasta.

import { ForbiddenError } from '@core/errors';
import { OrganizationAuthorizationHelper } from '@modules/organization/organization-authorization.helper';
import { recordBusinessAuditSafely } from '@modules/business-audit/business-audit.helpers';
import type { BusinessAction } from './business-permissions.types';
import { getAllowedRoles, requiresPermission } from './business-permissions.types';

export interface AuthorizationCheckResult {
  allowed: boolean;
  reason?: string;
  requiredRoles?: string[];
  userRole?: string | null;
}

class BusinessAuthorizationService {
  /**
   * Verifica se usuário tem permissão para executar ação
   * 
   * ⚠️ LEGACY — PROIBIDO USAR COMO DECISÃO FINAL
   * Usar apenas authorization.service.canActAs()
   * 
   * @param tenantId - ID do tenant
   * @param userId - ID do usuário
   * @param actorId - ID do actor (organization/company)
   * @param action - Ação a verificar
   * @param contextId - ID do contexto (opcional, para auditoria)
   * @returns Resultado da verificação
   */
  async checkPermission(
    tenantId: string,
    userId: string,
    actorId: string,
    action: BusinessAction,
    contextId?: string
  ): Promise<AuthorizationCheckResult> {
    // Verificar se ação requer permissão
    if (!requiresPermission(action)) {
      return { allowed: true, reason: 'Ação não requer permissão' };
    }

    // Obter roles permitidos para a ação
    const allowedRoles = getAllowedRoles(action);

    // Verificar se usuário tem algum dos roles permitidos
    const userRole = await OrganizationAuthorizationHelper.getUserRole(tenantId, userId, actorId);
    
    if (!userRole) {
      // Registrar negação de permissão (não bloqueante)
      if (contextId) {
        try {
          await recordBusinessAuditSafely(tenantId, {
            action: 'permission_denied' as any, // Adicionar ao enum se necessário
            actorId,
            userId,
            contextType: 'event' as any, // Tipo genérico
            contextId,
            metadata: {
              requestedAction: action,
              reason: 'Usuário não possui role na organização',
            },
          });
        } catch (auditError) {
          console.error('Erro ao registrar negação de permissão:', auditError);
        }
      }

      return {
        allowed: false,
        reason: 'Usuário não possui role na organização',
        requiredRoles: allowedRoles,
        userRole: null,
      };
    }

    const hasPermission = allowedRoles.includes(userRole);

    if (!hasPermission) {
      // Registrar negação de permissão (não bloqueante)
      if (contextId) {
        try {
          await recordBusinessAuditSafely(tenantId, {
            action: 'permission_denied',
            actorId,
            userId,
            contextType: this._inferContextType(action),
            contextId,
            metadata: {
              requestedAction: action,
              userRole,
              requiredRoles: allowedRoles,
              reason: `Role ${userRole} não tem permissão para ${action}`,
            },
          });
        } catch (auditError) {
          console.error('Erro ao registrar negação de permissão:', auditError);
        }
      }

      return {
        allowed: false,
        reason: `Role ${userRole} não tem permissão para executar ${action}. Roles permitidos: ${allowedRoles.join(', ')}`,
        requiredRoles: allowedRoles,
        userRole,
      };
    }

    return {
      allowed: true,
      reason: `Role ${userRole} tem permissão para ${action}`,
      requiredRoles: allowedRoles,
      userRole,
    };
  }

  /**
   * Valida permissão e lança erro se não permitido
   * 
   * ⚠️ LEGACY — PROIBIDO USAR COMO DECISÃO FINAL
   * Usar apenas authorization.service.canActAs()
   * 
   * @param tenantId - ID do tenant
   * @param userId - ID do usuário
   * @param actorId - ID do actor
   * @param action - Ação a verificar
   * @param contextId - ID do contexto (opcional)
   * @throws ForbiddenError se não tiver permissão
   */
  async requirePermission(
    tenantId: string,
    userId: string,
    actorId: string,
    action: BusinessAction,
    contextId?: string
  ): Promise<void> {
    const check = await this.checkPermission(tenantId, userId, actorId, action, contextId);

    if (!check.allowed) {
      throw new ForbiddenError(
        check.reason || `Você não tem permissão para executar ${action}`
      );
    }
  }

  /**
   * Verifica se usuário tem qualquer uma das ações permitidas
   * 
   * ⚠️ LEGACY — PROIBIDO USAR COMO DECISÃO FINAL
   * Usar apenas authorization.service.canActAs()
   */
  async hasAnyPermission(
    tenantId: string,
    userId: string,
    actorId: string,
    actions: BusinessAction[],
    contextId?: string
  ): Promise<AuthorizationCheckResult> {
    for (const action of actions) {
      const check = await this.checkPermission(tenantId, userId, actorId, action, contextId);
      if (check.allowed) {
        return check;
      }
    }

    return {
      allowed: false,
      reason: `Usuário não tem permissão para nenhuma das ações: ${actions.join(', ')}`,
      requiredRoles: actions.flatMap(a => getAllowedRoles(a)),
    };
  }

  /**
   * Infere o tipo de contexto baseado na ação
   */
  private _inferContextType(action: BusinessAction): 'event' | 'rfq' | 'booking' | 'service_order' | 'bundle' | 'split' {
    if (action.startsWith('event:')) return 'event';
    if (action.startsWith('rfq:') || action.startsWith('quote:')) return 'rfq';
    if (action.startsWith('booking:')) return 'booking';
    if (action.startsWith('service_order:')) return 'service_order';
    if (action.startsWith('bundle:')) return 'bundle';
    if (action.startsWith('financial_terms:') || action.startsWith('split:')) return 'split';
    return 'event'; // Default
  }
}

export const businessAuthorizationService = new BusinessAuthorizationService();

