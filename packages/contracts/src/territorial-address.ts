/**
 * @unificard/contracts — Endereço territorial do Actor (onboarding canônico PF/residência).
 *
 * F-ADDRESS-ONBOARDING-CANONICAL-FLOW (RFC A1-D). Contratos que cruzam frontend ↔ backend para:
 *  - preview postal ESTREITO (projeção do resolver da Fase B, sem internals de provider);
 *  - comando set/replace (compõe re-resolução server-side + writer selado da Fase C);
 *  - leitura do endereço actor-scoped vigente;
 *  - códigos de erro públicos estáveis.
 *
 * NUNCA expõe providerEvidence/responseHash/cacheHit/URLs/coordenadas/payload bruto.
 * IDs canônicos (cityId/neighborhoodId) trafegam como CROSS-CHECK, nunca como autoridade final —
 * o backend RE-RESOLVE e é a autoridade.
 */

/** Status de bairro na resolução (espelha a semântica selada da Fase B, sem internals). */
export type TerritorialNeighborhoodStatus =
  | 'resolved'
  | 'candidate_requires_confirmation'
  | 'pending'
  | 'not_applicable';

/** Purpose público do MVP. Só residência (PF) nesta fase; role é derivado server-side. */
export type TerritorialAddressPurpose = 'ACTOR_RESIDENCE';

/** Preview postal ESTREITO — projeção pública do resolver da Fase B (sucesso). */
export interface PostalAddressPreview {
  status: 'resolved';
  country: { id: string; code: string; displayName: string };
  state: { id: string; code: string; displayName: string };
  city: { id: string; displayName: string };
  neighborhood: {
    id: string | null;
    candidateId: string | null;
    status: TerritorialNeighborhoodStatus;
    displayName: string | null;
  };
  postalCode: string;
  street: string | null;
  requiresUserConfirmation: true;
}

/** Comando público set/replace do endereço territorial do Actor (residência PF). */
export interface SetTerritorialAddressCommand {
  purpose: TerritorialAddressPurpose;
  countryCode: string;
  postalCode: string;
  street: string;
  number: string;
  complement?: string | null;
  /** Cross-check contra a re-resolução server-side (não é autoridade final). */
  confirmedCityId: string;
  /** Só quando o bairro foi 'resolved'; caso contrário null/ausente. */
  confirmedNeighborhoodId?: string | null;
  /** Chave opaca de idempotência (preferência UUID) gerada pelo cliente por intenção de salvar. */
  idempotencyKey: string;
}

/** Resultado público da escrita (projeção do writer selado da Fase C). */
export interface TerritorialAddressWriteResult {
  actorId: string;
  purpose: TerritorialAddressPurpose;
  role: 'RESIDENCE';
  outcome: 'set' | 'replaced';
  assignmentId: string;
  addressId: string;
  /** true quando a resposta veio de replay idempotente (sem nova mutação). */
  replayed: boolean;
}

/** Leitura pública do endereço territorial vigente (projeção do read-model actor-scoped). */
export type TerritorialAddressCurrent =
  | { state: 'none'; actorId: string; purpose: TerritorialAddressPurpose; role: 'RESIDENCE' }
  | {
      state: 'active';
      actorId: string;
      purpose: TerritorialAddressPurpose;
      role: 'RESIDENCE';
      addressId: string;
      country: { id: string; displayName: string } | null;
      state_: { id: string; code: string; displayName: string } | null;
      city: { id: string; displayName: string } | null;
      neighborhood: { id: string; displayName: string } | null;
      postalCode: string | null;
      street: string | null;
      number: string | null;
      complement: string | null;
      effectiveAt: string | null;
      /** 'actor_scoped' quando canônico; 'legacy_profile_fallback' na compat read-only do GET legado. */
      source: 'actor_scoped' | 'legacy_profile_fallback';
    };

/** Códigos de erro públicos ESTÁVEIS (não vazam internals/infra). */
export const TERRITORIAL_ADDRESS_ERROR_CODES = [
  'authority_denied',
  'actor_not_eligible',
  'country_required',
  'country_not_supported',
  'postal_code_invalid',
  'provider_unavailable',
  'provider_not_found',
  'provider_conflict',
  'official_identifier_missing',
  'official_identifier_conflict',
  'canonical_city_missing',
  'canonical_city_ambiguous',
  'territorial_inconsistency',
  'territorial_confirmation_mismatch',
  'actor_territorial_in_progress',
  'idempotency_payload_mismatch',
  'invalid_address_payload',
  'unexpected_error',
] as const;

export type TerritorialAddressErrorCode = (typeof TERRITORIAL_ADDRESS_ERROR_CODES)[number];

export interface TerritorialAddressErrorBody {
  error: TerritorialAddressErrorCode;
  message?: string;
}
