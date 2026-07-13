// src/core/location/postal-resolution.types.ts
// FASE B (RFC B1-D) — contrato canônico READ-ONLY de resolução postal.
//
// 🔴 A Fase B RESOLVE e SUGERE território; NUNCA escreve território. Nenhum estado de sucesso
//    existe sem cityId canônico do Location Core. O provider é evidência, não autoridade.
// 🔴 O contrato NÃO carrega Actor/tenant/role, NÃO carrega comando de escrita, NÃO carrega
//    existingAddressId e NÃO compõe com a autoridade da Fase C — a composição
//    `resolver B → confirmação humana → writer C` é papel da futura camada de API/onboarding.
// 🔴 Bairro: texto de provider NUNCA vira identidade. `neighborhoodId` só nasce de alias
//    GOVERNADO vigente dentro da MESMA city; nome coincidente vira no máximo CANDIDATO
//    (`neighborhoodCandidateId`, exige confirmação); sem match → pending; sem bairro → not_applicable.

/** Providers governados vivos. 'mock' existe para testes determinísticos sem rede. */
export type PostalProviderId = 'viacep' | 'brasilapi' | 'mock';

/** Evidência mínima de consulta a provider — sem payload bruto, sem PII além do necessário. */
export interface PostalProviderEvidence {
  provider: PostalProviderId;
  countryCode: string;
  postalCodeNormalized: string;
  queriedAt: string;
  outcome: 'resolved' | 'not_found' | 'unavailable' | 'malformed' | 'conflict';
  officialCityCode: string | null;
  stateCode: string | null;
  responseHash: string | null;
  cacheHit: boolean;
}

export type PostalNeighborhoodStatus =
  | 'resolved'
  | 'candidate_requires_confirmation'
  | 'pending'
  | 'not_applicable';

/**
 * Estados de falha explícitos e fail-closed (D-D/D-J). `official_identifier_missing` cobre o
 * provider que resolve o endereço mas não entrega identificador oficial suficiente — nunca se
 * resolve city por nome no lugar (D-C/D-D).
 */
export type PostalResolutionFailureStatus =
  | 'country_required'
  | 'country_not_supported'
  | 'postal_code_invalid'
  | 'provider_unavailable'
  | 'provider_not_found'
  | 'provider_conflict'
  | 'malformed_provider_response'
  | 'official_identifier_missing'
  | 'official_identifier_conflict'
  | 'canonical_city_missing'
  | 'canonical_city_ambiguous'
  | 'territorial_inconsistency';

export type PostalAddressResolution =
  | {
      status: 'resolved';
      countryId: string;
      stateId: string;
      cityId: string;
      neighborhoodId: string | null;
      neighborhoodCandidateId: string | null;
      neighborhoodStatus: PostalNeighborhoodStatus;
      postalCodeNormalized: string;
      street: string | null;
      neighborhoodDisplayText: string | null;
      cityDisplayText: string | null;
      stateDisplayText: string | null;
      providerEvidence: PostalProviderEvidence[];
      /** Sempre true: a sugestão NUNCA grava nada sozinha — confirmação humana antes do writer C. */
      requiresUserConfirmation: true;
    }
  | {
      status: PostalResolutionFailureStatus;
      providerEvidence: PostalProviderEvidence[];
    };

/** Entrada canônica: país SEMPRE explícito (D-B). Sem default silencioso de BR. */
export interface PostalResolutionRequest {
  countryCode: string;
  postalCode: string;
}
