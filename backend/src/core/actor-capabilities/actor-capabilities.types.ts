// backend/src/core/actor-capabilities/actor-capabilities.types.ts
// 2026-05-18 P1 — Capability Resolver MVP
//
// Tipos para agregação READ-ONLY de capabilities derivadas de SSOT existentes.
// Conforme memória project_home_contextual_modelo_2026-05-18.md:
//   "Capability é OUTPUT, não INPUT. Não tem SSOT próprio. Resulta da
//    composição actor + tempo + mode + contexto + relação + authority + saldo."
//
// Este resolver MVP entrega CAPABILITY DERIVADA de:
//   - actors.actor_type (capabilities base por tipo)
//   - company_users.role + permissions (quando actor é page)
//   - actor_delegations (delegações ativas para institutionalActorId)
//
// NÃO altera soberania. NÃO cria authority. Apenas agrega.

/**
 * Capability key — string canônica no formato `<domain>.<action>`.
 * Lista vinculada à constante CAPABILITY_KEYS em actor-capabilities.service.ts.
 */
export type CapabilityKey = string;

export interface ActorCapabilitiesDelegation {
  /** ID do actor institucional ao qual o user actor delegou. */
  institutionalActorId: string;
  /** Scopes da delegação (lista livre, gravada em actor_delegations.scopes_json). */
  scopes: string[];
  /** Delegação transitiva (permite re-delegar). */
  isTransitive: boolean;
  /** Data de expiração ISO ou null se sem prazo. */
  expiresAt: string | null;
  /** R2.3 — vínculo jurídico governado (relationship_type): partner/director/administrator/attorney/
   *  legal_representative/employee/contractor, ou null (delegação legada/genérica sem vínculo classificado). */
  relationshipType: string | null;
}

export interface ActorCapabilitiesResponse {
  /** Actor sobre o qual a resolução foi feita. */
  actorId: string;
  /** Tipo do actor. */
  actorType: 'user' | 'page' | 'group' | 'channel';
  /**
   * Capabilities efetivas no momento da resolução. Lista derivada (não SSOT).
   * Frontend pode usar para PRIORIZAR UX — nunca para esconder authority sem
   * confirmação backend explícita em fluxo crítico.
   */
  capabilities: CapabilityKey[];
  /**
   * Papel do user autenticado em relação ao actor. Para actor_type='user',
   * é 'self' quando o actor é o próprio user. Para 'page', é o role em
   * company_users.role (owner/director/manager/employee/staff/admin/contractor).
   */
  roleOnActor: string | null;
  /**
   * Delegações ativas onde este actor é institutionalActorId.
   * Para actor_type='user', representa para quem este user delegou.
   * Para outros tipos, representa quem delegou A ESTE actor (institutional).
   */
  delegations: ActorCapabilitiesDelegation[];
  /** Timestamp ISO da resolução. */
  resolvedAt: string;
  /** Marca a versão/fonte da agregação. */
  source: 'mvp-readonly-aggregation';
}
