"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TERRITORIAL_ADDRESS_ERROR_CODES = void 0;
/** Códigos de erro públicos ESTÁVEIS (não vazam internals/infra). */
exports.TERRITORIAL_ADDRESS_ERROR_CODES = [
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
];
