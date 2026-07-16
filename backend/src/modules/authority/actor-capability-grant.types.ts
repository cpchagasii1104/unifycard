// backend/src/modules/authority/actor-capability-grant.types.ts
// F-ACTOR-CAPABILITY-GRANTS-SCHEMA-AND-NONFIN-ENFORCEMENT-SLICE-1 (Slice 1A · DECISION-0136).
// N2-D.2 (DECISION-0173 + ADENDO D3): matriz scope_type x capability_key. Dois conjuntos POSITIVOS e
// EXPLÍCITOS — a existência da key vem de permission-keys.ts; ESTE arquivo decide, por conjunto exato
// (nunca prefixo/wildcard/regex/negação), em qual scope cada key forma um grant válido.

/** Conjunto ACTOR-SCOPED exato (espelha o CHECK da migration 20260616210000 + 20260626120000). */
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

/**
 * Alias N2-D.2 (DECISION-0173 ADENDO D3) — ACTOR_SCOPED_CAPABILITY_KEYS É o conjunto actor-scoped
 * (mesma array de NON_FINANCIAL_CAPABILITY_ALLOWLIST, NÃO duplicada; nome novo usado pela matriz
 * scope×capability). NON_FINANCIAL_CAPABILITY_ALLOWLIST permanece o nome canônico consumido por
 * actor-capability-grant.routes.ts (createGrantSchema.capabilityKey z.enum, actor-only — DECISION-0173 §16).
 */
export const ACTOR_SCOPED_CAPABILITY_KEYS = NON_FINANCIAL_CAPABILITY_ALLOWLIST;

/**
 * Conjunto TERRITORIAL exato (DECISION-0173 §4 + ADENDO D3.3) — exatamente as seis keys ratificadas.
 * Nenhuma outra key pode formar grant scope_type='territory' no MVP. Espelha o CHECK
 * chk_acg_scope_capability_matrix da migration N2-D.2.
 */
export const TERRITORIAL_CAPABILITY_KEYS = [
  'territory:create_neighborhood',
  'territory:approve_neighborhood',
  'territory:correct_neighborhood',
  'territory:deactivate_neighborhood',
  'territory:manage_neighborhood_aliases',
  'territory:register_neighborhood_succession',
] as const;

/**
 * Conjunto REGIONAL-TREASURY exato (DECISION-0185 D5/D7) — EXATAMENTE as duas Authority Grant Keys
 * financeiras regionais. Nenhuma outra key pode formar grant scope_type='regional_treasury'. Espelha o
 * CHECK físico chk_acg_capability_regional_treasury (migration 20260716140000). Ambas CRITICAL_FINANCIAL,
 * separadas e NÃO fusíveis (dois grants independentes). ESTE arquivo é o registry REAL destas grant keys —
 * NÃO permission-keys.ts (DECISION-0185 D11/D13) e NÃO TreasuryOperationSource (registry disjunto, D12).
 */
export const REGIONAL_TREASURY_CAPABILITY_KEYS = [
  'treasury:regional_policy_manage',
  'treasury:regional_fund_activation_manage',
] as const;

/**
 * União DERIVADA — projeção de compatibilidade apenas. NÃO decide se um grant é válido; NÃO
 * substitui o discriminante scope_type; NÃO é usada em create/grant. (ADENDO D3 §D3.6.)
 */
export const GRANT_CAPABILITY_KEYS = [
  ...ACTOR_SCOPED_CAPABILITY_KEYS,
  ...TERRITORIAL_CAPABILITY_KEYS,
  ...REGIONAL_TREASURY_CAPABILITY_KEYS,
] as const;

export type ActorScopedCapabilityKey = (typeof ACTOR_SCOPED_CAPABILITY_KEYS)[number];
export type TerritorialCapabilityKey = (typeof TERRITORIAL_CAPABILITY_KEYS)[number];
export type RegionalTreasuryCapabilityKey = (typeof REGIONAL_TREASURY_CAPABILITY_KEYS)[number];
export type GrantableCapabilityKey = (typeof GRANT_CAPABILITY_KEYS)[number];

/** Discriminante de escopo canônico (DECISION-0185 D2): actor | territory | regional_treasury. */
export type CapabilityGrantScopeType = 'actor' | 'territory' | 'regional_treasury';

const ACTOR_SCOPED_SET: ReadonlySet<string> = new Set(ACTOR_SCOPED_CAPABILITY_KEYS);
const TERRITORIAL_SET: ReadonlySet<string> = new Set(TERRITORIAL_CAPABILITY_KEYS);
const REGIONAL_TREASURY_SET: ReadonlySet<string> = new Set(REGIONAL_TREASURY_CAPABILITY_KEYS);

export function isActorScopedCapabilityKey(key: string): key is ActorScopedCapabilityKey {
  return ACTOR_SCOPED_SET.has(key);
}

export function isTerritorialCapabilityKey(key: string): key is TerritorialCapabilityKey {
  return TERRITORIAL_SET.has(key);
}

export function isRegionalTreasuryCapabilityKey(key: string): key is RegionalTreasuryCapabilityKey {
  return REGIONAL_TREASURY_SET.has(key);
}

/**
 * Correspondência por CONJUNTO EXATO — nunca por prefixo/wildcard (`startsWith('territory:')` ou
 * `startsWith('treasury:')` é inferência de autoridade, PROIBIDA — ADENDO D3.4 / DECISION-0185 D12).
 * Lança se a key não pertencer ao conjunto EXATO do scope informado.
 */
export function assertCapabilityCompatibleWithScope(scopeType: CapabilityGrantScopeType, capabilityKey: string): void {
  if (scopeType === 'actor' && !isActorScopedCapabilityKey(capabilityKey)) {
    throw new Error(
      `CAPABILITY_SCOPE_MISMATCH: '${capabilityKey}' não pertence ao conjunto actor-scoped — matriz scope_type x capability_key (DECISION-0173).`
    );
  }
  if (scopeType === 'territory' && !isTerritorialCapabilityKey(capabilityKey)) {
    throw new Error(
      `CAPABILITY_SCOPE_MISMATCH: '${capabilityKey}' não pertence ao conjunto territorial — matriz scope_type x capability_key (DECISION-0173).`
    );
  }
  if (scopeType === 'regional_treasury' && !isRegionalTreasuryCapabilityKey(capabilityKey)) {
    throw new Error(
      `CAPABILITY_SCOPE_MISMATCH: '${capabilityKey}' não pertence ao conjunto regional-treasury — matriz scope_type x capability_key (DECISION-0185).`
    );
  }
}

export type CapabilityGrantStatus = 'active' | 'revoked' | 'expired' | 'suspended';
export type CapabilityGrantEventType = 'granted' | 'revoked' | 'expired';

export interface ActorCapabilityGrant {
  grantId: string;
  tenantId: string | null;
  granteeActorId: string;
  capabilityKey: string;
  scopeType: CapabilityGrantScopeType;
  scopeActorId: string | null;
  scopeCityId: string | null;
  grantedByUserId: string;
  grantedByActorId: string;
  authoritySource: string;
  status: CapabilityGrantStatus;
  validFrom: string;
  validUntil: string | null;
  revokedAt: string | null;
  revokedByActorId: string | null;
  reason: string | null;
  revokeReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GrantCapabilityInput {
  granteeActorId: string;          // actor resolvido server-side (nunca slug/referral)
  capabilityKey: ActorScopedCapabilityKey;
  scopeActorId: string;
  grantedByUserId: string;         // req.user.userId REAL — também executedByUserId do evento 'granted'
  grantedByActorId: string;        // actor do concedente (validado) — também executedByActorId do evento
  // responsibleHumanActorId NÃO é campo de input — o service resolve server-side via
  // findByUserId(grantedByUserId), nunca recebido do caller (DECISION-0171 §6.1-D).
  validUntil?: Date | null;
  reason?: string | null;
  eventReason: string;             // motivo específico do evento 'granted' (append-only)
}

export interface RevokeCapabilityInput {
  grantId: string;
  executedByUserId: string;
  executedByActorId: string;
  responsibleHumanActorId: string;
  revokeReason: string;            // motivo próprio da revogação — NUNCA sobrescreve reason da concessão
}
