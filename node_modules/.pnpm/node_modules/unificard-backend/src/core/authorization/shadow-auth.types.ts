// backend/src/core/authorization/shadow-auth.types.ts
// Tipos e reason codes para Shadow Authorization (Fase 2B)

export type ShadowAuthReasonCode =
  | 'SSOT_ROOT_NOT_FOUND'
  | 'SSOT_ROOT_INACTIVE'
  | 'SSOT_ATL_BLOCKED'
  | 'SSOT_GUARDIANSHIP_ACTIVE'
  | 'SSOT_DELEGATION_ALLOWED'
  | 'SSOT_DELEGATION_MISSING'
  | 'SSOT_RBAC_DENIED'
  | 'SSOT_RBAC_ALLOWED'
  | 'SHADOW_ALLOW_LEGACY_DENY'
  | 'SHADOW_DENY_LEGACY_ALLOW'
  | 'SHADOW_TIMEOUT'
  | 'SHADOW_ERROR';

export interface ShadowAuthDivergenceLog {
  event: 'SHADOW_AUTH_DIVERGENCE';
  tenant_id: string;
  actor_id: string;
  user_id: string;
  permission_key: string;
  resource?: string;
  action?: string;
  decision_legacy: boolean;
  decision_shadow: boolean;
  reason_code: ShadowAuthReasonCode;
  shadow_reason?: string;
  timestamp: string;
}

export interface ShadowAuthResult {
  allowed: boolean;
  reasonCode: ShadowAuthReasonCode;
  reason?: string;
}




