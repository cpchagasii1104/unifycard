// frontend/src/api/business-permissions.ts
// API Client para verificar permissões (apenas para UI)
// 🔴 BLINDAGEM: Frontend apenas esconde UI (não decide)
// 🔴 BLINDAGEM: Backend é fonte única de verdade

import { apiFetch } from './client';

export type BusinessAction =
  | 'event:create'
  | 'event:update'
  | 'event:delete'
  | 'event:publish'
  | 'event:cancel'
  | 'rfq:create'
  | 'rfq:close'
  | 'rfq:view'
  | 'quote:submit'
  | 'quote:view'
  | 'rfq:convert'
  | 'booking:request'
  | 'booking:decide'
  | 'booking:confirm'
  | 'booking:view'
  | 'booking:cancel'
  | 'service_order:create'
  | 'service_order:confirm'
  | 'service_order:start'
  | 'service_order:complete'
  | 'service_order:cancel'
  | 'service_order:view'
  | 'financial_terms:view'
  | 'financial_terms:confirm'
  | 'split:view'
  | 'split:create'
  | 'bundle:create'
  | 'bundle:confirm'
  | 'bundle:view'
  | 'calendar:view'
  | 'calendar:block'
  | 'calendar:unblock';

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiredRoles?: string[];
  userRole?: string | null;
}

/**
 * Verificar permissão (apenas para UI - backend sempre valida)
 * 🔴 BLINDAGEM: Não confiar neste resultado para decisões críticas
 */
export async function checkPermission(
  action: BusinessAction,
  actorId: string,
  contextId?: string
): Promise<PermissionCheckResult> {
  const params = new URLSearchParams();
  params.append('action', action);
  params.append('actorId', actorId);
  if (contextId) params.append('contextId', contextId);

  const response = await apiFetch(`/business-permissions/check?${params.toString()}`);

  if (!response.ok) {
    // Se falhar, assumir que não tem permissão (seguro)
    return {
      allowed: false,
      reason: 'Erro ao verificar permissão',
    };
  }

  return response.json();
}




