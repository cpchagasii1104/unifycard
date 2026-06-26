// backend/src/modules/authority/actor-capability-grant.types.ts
// F-ACTOR-CAPABILITY-GRANTS-SCHEMA-AND-NONFIN-ENFORCEMENT-SLICE-1 (Slice 1A · DECISION-0136).
// Substrato de capability grants POR ACTOR. NENHUM enforcement em rota de negócio neste Slice.

/** Capabilities NÃO-financeiras concedíveis no MVP (espelha o CHECK da migration). */
export const NON_FINANCIAL_CAPABILITY_ALLOWLIST = [
  'calendar:block',
  'calendar:unblock',
  'services:create',
  'services:edit',
  'services:disable',
  // 🔴 F-OPERATOR-SERVICE-ORDER-VIEW-GRANT — LEITURA operacional de ordem de serviço (não-financeira).
  // Espelha o CHECK chk_acg_capability_nonfinancial (migration 20260626120000) e permission-keys.ts.
  'service_order:view',
] as const;

export type GrantableCapabilityKey = (typeof NON_FINANCIAL_CAPABILITY_ALLOWLIST)[number];

export type CapabilityGrantStatus = 'active' | 'revoked' | 'expired' | 'suspended';

export interface ActorCapabilityGrant {
  grantId: string;
  tenantId: string;
  granteeActorId: string;
  capabilityKey: string;
  scopeType: 'actor';
  scopeActorId: string;
  grantedByUserId: string;
  grantedByActorId: string;
  authoritySource: string;
  status: CapabilityGrantStatus;
  validFrom: string;
  validUntil: string | null;
  revokedAt: string | null;
  revokedByActorId: string | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GrantCapabilityInput {
  granteeActorId: string;          // actor resolvido server-side (nunca slug/referral)
  capabilityKey: GrantableCapabilityKey;
  scopeActorId: string;
  grantedByUserId: string;         // req.user.userId REAL
  grantedByActorId: string;        // actor do concedente (validado)
  validUntil?: Date | null;
  reason?: string | null;
}
