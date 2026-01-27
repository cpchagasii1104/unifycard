// backend/src/core/authorization/business-permissions.types.ts
// PermissionMap Canônico para Ações Críticas de Negócio
// 🔴 BLINDAGEM: Backend é fonte única de verdade
// 🔴 BLINDAGEM: Frontend apenas esconde UI (não decide)

import type { OrganizationRoleKey } from '@modules/organization/organization.types';

/**
 * Ações críticas do sistema que requerem permissão
 */
export type BusinessAction =
  // Eventos
  | 'event:create'
  | 'event:update'
  | 'event:delete'
  | 'event:publish'
  | 'event:cancel'
  
  // RFQs
  | 'rfq:create'
  | 'rfq:close'
  | 'rfq:view'
  | 'quote:submit'
  | 'quote:view'
  | 'rfq:convert'
  
  // Bookings
  | 'booking:request'
  | 'booking:decide'
  | 'booking:confirm'
  | 'booking:view'
  | 'booking:cancel'
  
  // Service Orders
  | 'service_order:create'
  | 'service_order:confirm'
  | 'service_order:start'
  | 'service_order:complete'
  | 'service_order:cancel'
  | 'service_order:view'
  
  // Splits Financeiros
  | 'financial_terms:view'
  | 'financial_terms:confirm'
  | 'split:view'
  | 'split:create'
  
  // Bundles
  | 'bundle:create'
  | 'bundle:confirm'
  | 'bundle:view'
  
  // Agenda
  | 'calendar:view'
  | 'calendar:block'
  | 'calendar:unblock'
  
  // Payouts
  | 'financial:execute_payout'
  | 'financial:view_ledger'
  | 'financial:view_all_ledger'
  
  // Marketplace Store
  | 'MARKETPLACE_STORE_CREATE'
  | 'MARKETPLACE_STORE_VIEW'
  | 'MY_ORDERS_VIEW';

/**
 * PermissionMap Canônico
 * Mapeia ações críticas para roles permitidos
 */
export const BUSINESS_PERMISSION_MAP: Record<BusinessAction, OrganizationRoleKey[]> = {
  // Eventos
  'event:create': ['OWNER', 'ADMIN', 'MANAGER'],
  'event:update': ['OWNER', 'ADMIN', 'MANAGER'],
  'event:delete': ['OWNER', 'ADMIN'],
  'event:publish': ['OWNER', 'ADMIN', 'MANAGER'],
  'event:cancel': ['OWNER', 'ADMIN', 'MANAGER'],
  
  // RFQs
  'rfq:create': ['OWNER', 'ADMIN', 'MANAGER'],
  'rfq:close': ['OWNER', 'ADMIN', 'MANAGER'],
  'rfq:view': ['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR'],
  'quote:submit': ['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR'], // Provider pode responder
  'quote:view': ['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR'],
  'rfq:convert': ['OWNER', 'ADMIN', 'MANAGER'],
  
  // Bookings
  'booking:request': ['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR'], // Qualquer um pode solicitar
  'booking:decide': ['OWNER', 'ADMIN', 'MANAGER'], // Provider decide
  'booking:confirm': ['OWNER', 'ADMIN', 'MANAGER'], // Organizador confirma
  'booking:view': ['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR'],
  'booking:cancel': ['OWNER', 'ADMIN', 'MANAGER'],
  
  // Service Orders
  'service_order:create': ['OWNER', 'ADMIN', 'MANAGER'],
  'service_order:confirm': ['OWNER', 'ADMIN', 'MANAGER'],
  'service_order:start': ['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR'], // Provider/Staff pode iniciar
  'service_order:complete': ['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR'], // Provider/Staff pode completar
  'service_order:cancel': ['OWNER', 'ADMIN', 'MANAGER'],
  'service_order:view': ['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR'],
  
  // Splits Financeiros
  'financial_terms:view': ['OWNER', 'ADMIN', 'MANAGER', 'FINANCE'],
  'financial_terms:confirm': ['OWNER', 'ADMIN', 'FINANCE'], // Apenas owner/finance pode confirmar
  'split:view': ['OWNER', 'ADMIN', 'MANAGER', 'FINANCE'],
  'split:create': ['OWNER', 'ADMIN', 'FINANCE'], // Apenas owner/finance pode criar
  
  // Bundles
  'bundle:create': ['OWNER', 'ADMIN', 'MANAGER'],
  'bundle:confirm': ['OWNER', 'ADMIN', 'MANAGER'],
  'bundle:view': ['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR'],
  
  // Agenda
  'calendar:view': ['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR'],
  'calendar:block': ['OWNER', 'ADMIN', 'MANAGER'],
  'calendar:unblock': ['OWNER', 'ADMIN', 'MANAGER'],
  
  // Payouts
  'financial:execute_payout': ['OWNER', 'ADMIN', 'FINANCE'],
  'financial:view_ledger': ['OWNER', 'ADMIN', 'FINANCE', 'MANAGER'],
  'financial:view_all_ledger': ['OWNER', 'ADMIN', 'FINANCE'],
  
  // Marketplace Store
  'MARKETPLACE_STORE_CREATE': ['OWNER', 'ADMIN', 'MANAGER'],
  'MARKETPLACE_STORE_VIEW': ['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR'],
  'MY_ORDERS_VIEW': ['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR'], // Qualquer usuário pode ver seus próprios pedidos
};

/**
 * Verifica se uma ação requer permissão
 */
export function requiresPermission(action: string): action is BusinessAction {
  return action in BUSINESS_PERMISSION_MAP;
}

/**
 * Obtém roles permitidos para uma ação
 */
export function getAllowedRoles(action: BusinessAction): OrganizationRoleKey[] {
  return BUSINESS_PERMISSION_MAP[action] || [];
}

