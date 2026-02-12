// backend/src/core/authorization/soft-block.types.ts
// Tipos e reason codes para Soft-Block (Fase 3)

export type SoftBlockReasonCode =
  | 'SOFT_BLOCK_PROHIBITED_FLAGS'
  | 'SOFT_BLOCK_PROHIBITED_COMPANY_ROLE'
  | 'SOFT_BLOCK_PROHIBITED_CAPABILITIES'
  | 'SOFT_BLOCK_TRANSITIVE_DELEGATION'
  | 'SOFT_BLOCK_DELEGATION_WITHOUT_EXPIRY'
  | 'SOFT_BLOCK_DELEGATION_WITHOUT_SCOPE'
  | 'SOFT_BLOCK_DELEGATION_WILDCARD_SCOPE'
  | 'LOG_ONLY_RBAC_ROLE_ASSIGNMENT'
  | 'LOG_ONLY_CAPABILITIES_UPDATE';

export type SoftBlockMode = 'BLOCKED' | 'LOG_ONLY';

export interface SoftBlockAttemptLog {
  event: 'SOFT_BLOCK_AUTHORITY_ATTEMPT';
  mode: SoftBlockMode;
  tenant_id: string;
  actor_id?: string;
  user_id?: string;
  source_trilho: string;
  reason_code: SoftBlockReasonCode;
  request_id?: string;
  timestamp: string;
  details?: Record<string, any>;
}




