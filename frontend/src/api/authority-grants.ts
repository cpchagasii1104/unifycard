// frontend/src/api/authority-grants.ts
// F-MVP-SERVICE-CHAIN-FRONTEND-WIRING-SLICE-1 (GAP-B) — 2026-06-27.
// Client mínimo do substrato CANÔNICO de capability grants por actor (DECISION-0136):
//   actor_capability_grants via modules/authority/actor-capability-grant.routes.ts.
//   - POST   /authority/grants                 → concede (gate backend: canRepresentActor(scopeActorId)).
//   - GET    /authority/grants?scopeActorId=…   → lista (gate backend: canRepresentActor(scopeActorId)).
//   - POST   /authority/grants/:grantId/revoke  → revoga (gate backend: canRepresentActor(scopeActorId)).
// "Frontend nunca cria verdade — projeta verdade resolvida": este client NÃO decide autoridade; só
// projeta a concessão que o backend autoriza/recusa. NÃO usa business-permissions (RBAC legado de
// CHECAGEM, jamais concessor), NÃO usa organization_*, NÃO toca dinheiro/financial-terms.
// MVP: só a capability NÃO-financeira de LEITURA 'service_order:view' é usada por esta superfície.

import { apiFetchJson } from './client';

/** Capabilities NÃO-financeiras concedíveis (espelha NON_FINANCIAL_CAPABILITY_ALLOWLIST do backend).
 *  Tipado para IMPEDIR que esta superfície envie capability de escrita/estado/financeira. */
export type NonFinancialCapabilityKey =
  | 'calendar:block'
  | 'calendar:unblock'
  | 'services:create'
  | 'services:edit'
  | 'services:disable'
  | 'service_order:view';

export type CapabilityGrantStatus = 'active' | 'revoked' | 'expired' | 'suspended';

/** Espelha ActorCapabilityGrant do backend (modules/authority/actor-capability-grant.types.ts). */
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

export interface CreateGrantInput {
  /** Actor dono do escopo (o provider/empresa cujas ordens serão visíveis). Obrigatório. */
  scopeActorId: string;
  /** Capability concedida — restrita às NÃO-financeiras pelo tipo. */
  capabilityKey: NonFinancialCapabilityKey;
  /** Identifica o operador que recebe: por id OU por slug (um dos dois é obrigatório no backend). */
  granteeActorId?: string;
  granteeActorSlug?: string;
  /** Expiração opcional (ISO 8601). */
  validUntil?: string;
  reason?: string;
}

export interface ListGrantsFilters {
  capabilityKey?: NonFinancialCapabilityKey;
  granteeActorId?: string;
  status?: CapabilityGrantStatus;
}

/**
 * Lista grants escopados a um actor (provider). O backend exige canRepresentActor(scopeActorId).
 * GET /authority/grants?scopeActorId=…&capabilityKey=…&status=… → { grants: ActorCapabilityGrant[] }.
 */
export async function listGrantsForScope(
  scopeActorId: string,
  filters?: ListGrantsFilters
): Promise<ActorCapabilityGrant[]> {
  const params = new URLSearchParams();
  params.append('scopeActorId', scopeActorId);
  if (filters?.capabilityKey) params.append('capabilityKey', filters.capabilityKey);
  if (filters?.granteeActorId) params.append('granteeActorId', filters.granteeActorId);
  if (filters?.status) params.append('status', filters.status);
  const res = await apiFetchJson<{ grants: ActorCapabilityGrant[] }>(
    `/authority/grants?${params.toString()}`
  );
  return Array.isArray(res?.grants) ? res.grants : [];
}

/**
 * Concede uma capability NÃO-financeira a um operador, escopada ao provider (scopeActorId).
 * POST /authority/grants → 201 ActorCapabilityGrant. Autoridade é decidida no backend.
 */
export async function createGrant(input: CreateGrantInput): Promise<ActorCapabilityGrant> {
  return apiFetchJson<ActorCapabilityGrant>('/authority/grants', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Revoga um grant. POST /authority/grants/:grantId/revoke → ActorCapabilityGrant atualizado.
 * Backend exige canRepresentActor(scopeActorId do grant).
 */
export async function revokeGrant(grantId: string, reason?: string): Promise<ActorCapabilityGrant> {
  return apiFetchJson<ActorCapabilityGrant>(`/authority/grants/${grantId}/revoke`, {
    method: 'POST',
    body: JSON.stringify(reason ? { reason } : {}),
  });
}
