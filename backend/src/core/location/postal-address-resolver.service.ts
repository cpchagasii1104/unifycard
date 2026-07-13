// src/core/location/postal-address-resolver.service.ts
// FASE B (RFC B1-D) — CASA ÚNICA de resolução postal canônica. READ-ONLY.
//
// Fluxo canônico (D-A):
//   país explícito → normalizador postal do país → provider adapter governado → resposta
//   validada → resolução contra o Location Core → sugestão → confirmação humana futura →
//   writer SELADO da Fase C (composição pela futura camada de API/onboarding — NUNCA daqui).
//
// 🔴 NUNCA: criar city/state/neighborhood/address/assignment; escolher Actor/tenant/role;
//    chamar o writer/repository privado da Fase C; usar canRepresentActor; tocar Social/Bank.
// 🔴 city SÓ por identificador oficial escopado (state_id + external_code) — sem nome livre,
//    sem first-row, sem findOrCreate, sem INSERT (cidade ausente → canonical_city_missing, D-D).
// 🔴 fallback de provider SÓ por indisponibilidade governada (D-J); not_found/malformado são
//    estados explícitos, nunca mascarados por fallback; evidências comparáveis que discordam
//    produzem conflito explícito — nunca "a que parece melhor".
// 🔴 cache (D-I) é derivado: código armazenado é SEMPRE re-resolvido no Location Core; cache
//    incompatível com o Location Core é DESCARTADO (o Core prevalece) e o provider é consultado
//    de novo — a resolução fresca então CURA o cache via upsert.
// 🔴 A única escrita da Fase B é o upsert best-effort do cache derivado (BR apenas — a chave
//    viva é o CEP sem país; países futuros exigem evolução própria da chave antes de persistir).

import { createHash } from 'crypto';
import {
  getPostalProviderChain,
  type PostalProviderAdapter,
  type PostalProviderAddressData,
} from './cep-provider';
import {
  hasPostalNormalizerForCountry,
  normalizePostalCodeForCountry,
} from './postal-code-normalizer';
import {
  postalTerritorialEvidenceRepository,
  PostalTerritorialEvidenceRepository,
} from './postal-territorial-evidence.repository';
import type {
  PostalAddressResolution,
  PostalNeighborhoodStatus,
  PostalProviderEvidence,
  PostalProviderId,
  PostalResolutionRequest,
  PostalResolutionFailureStatus,
} from './postal-resolution.types';

/** Dependências injetáveis (testes determinísticos sem rede e sem banco). */
export interface PostalAddressResolverDeps {
  providerChain?: () => PostalProviderAdapter[];
  evidenceRepository?: PostalTerritorialEvidenceRepository;
  now?: () => Date;
}

interface ResolvedCountry { id: string; isoAlpha2: string }

interface PostalSource {
  data: PostalProviderAddressData;
  provider: PostalProviderId;
  fromCache: boolean;
}

type FreshQueryOutcome =
  | { kind: 'source'; source: PostalSource }
  | { kind: 'failure'; status: Extract<PostalResolutionFailureStatus, 'provider_unavailable' | 'provider_not_found' | 'malformed_provider_response'> };

/** Hash de evidência: campos normalizados, nunca payload bruto. */
function evidenceHash(stateCode: string | null, cityName: string | null, officialCityCode: string | null): string {
  return createHash('sha256')
    .update(`${stateCode ?? ''}|${cityName ?? ''}|${officialCityCode ?? ''}`)
    .digest('hex');
}

/** Mapeia o rótulo de provider persistido no cache legado para o vocabulário de evidência. */
function providerIdFromCacheLabel(label: string | null | undefined): PostalProviderId {
  if (label === 'BRASIL_API' || label === 'brasilapi') return 'brasilapi';
  if (label === 'VIA_CEP' || label === 'viacep') return 'viacep';
  return 'mock';
}

/**
 * D-J: evidências COMPARÁVEIS (todas as resolvidas do mesmo postal code) que discordam produzem
 * conflito EXPLÍCITO — nunca escolha silenciosa da "que parece melhor". Códigos oficiais
 * divergentes pesam mais que UF divergente.
 */
export function detectPostalEvidenceConflict(
  evidences: PostalProviderEvidence[]
): 'official_identifier_conflict' | 'provider_conflict' | null {
  const resolved = evidences.filter((e) => e.outcome === 'resolved');
  const codes = new Set(resolved.map((e) => e.officialCityCode).filter((c): c is string => !!c));
  if (codes.size > 1) return 'official_identifier_conflict';
  const ufs = new Set(resolved.map((e) => e.stateCode).filter((s): s is string => !!s));
  if (ufs.size > 1) return 'provider_conflict';
  return null;
}

export class PostalAddressResolverService {
  private readonly providerChain: () => PostalProviderAdapter[];
  private readonly repo: PostalTerritorialEvidenceRepository;
  private readonly now: () => Date;

  constructor(deps: PostalAddressResolverDeps = {}) {
    this.providerChain = deps.providerChain ?? getPostalProviderChain;
    this.repo = deps.evidenceRepository ?? postalTerritorialEvidenceRepository;
    this.now = deps.now ?? (() => new Date());
  }

  async resolve(request: PostalResolutionRequest): Promise<PostalAddressResolution> {
    const evidence: PostalProviderEvidence[] = [];

    // 1. País EXPLÍCITO (D-B): nada de default BR silencioso; "CEP" não prova Brasil.
    const rawCountry = typeof request.countryCode === 'string' ? request.countryCode.trim().toUpperCase() : '';
    if (!rawCountry) return { status: 'country_required', providerEvidence: evidence };
    if (!/^[A-Z]{2}$/.test(rawCountry)) return { status: 'country_not_supported', providerEvidence: evidence };
    const country = await this.repo.findCountryByIsoAlpha2(rawCountry);
    if (!country || !hasPostalNormalizerForCountry(country.isoAlpha2)) {
      return { status: 'country_not_supported', providerEvidence: evidence };
    }

    // 2. Normalização postal POR PAÍS (a regra de 8 dígitos é do normalizador BR, não global).
    const normalized = normalizePostalCodeForCountry(country.isoAlpha2, request.postalCode);
    if (!normalized.ok) return { status: 'postal_code_invalid', providerEvidence: evidence };
    const postalCode = normalized.value;

    // 3. Cache derivado (D-I) — SÓ BR (a chave viva é postal_code sem país). Cache com código
    //    oficial é acelerador (re-resolvido no Location Core abaixo); cache SEM código não vira
    //    fonte, mas permanece como evidência COMPARÁVEL contra a consulta fresca (conflito
    //    explícito, D-J).
    let source: PostalSource | null = null;
    let incompleteCacheEvidence: PostalProviderEvidence | null = null;
    if (country.isoAlpha2 === 'BR') {
      let cached = null;
      try {
        cached = await this.repo.findCachedResolution(postalCode);
      } catch {
        cached = null; // cache indisponível não bloqueia (segue para provider)
      }
      if (cached && cached.stateCode && cached.cityName) {
        const cachedData: PostalProviderAddressData = {
          stateCode: cached.stateCode,
          cityName: cached.cityName,
          officialCityCode: cached.cityExternalCode ?? null,
          neighborhoodText: cached.neighborhoodName ?? null,
          street: cached.street ?? null,
          lat: null,
          lng: null,
        };
        const cachedEvidence = this.mkEvidence(country, postalCode, providerIdFromCacheLabel(cached.provider), 'resolved', cachedData, true);
        if (cachedData.officialCityCode) {
          evidence.push(cachedEvidence);
          source = { data: cachedData, provider: cachedEvidence.provider, fromCache: true };
        } else {
          incompleteCacheEvidence = cachedEvidence;
        }
      }
    }

    // 4. Providers governados (D-J): consulta fresca quando não há fonte de cache utilizável.
    if (!source) {
      const fresh = await this.queryFreshProviders(country, postalCode, evidence);
      if (incompleteCacheEvidence) evidence.push(incompleteCacheEvidence);
      if (fresh.kind === 'failure') return { status: fresh.status, providerEvidence: evidence };

      // Evidências comparáveis (cache incompleto × fresca) que discordam → conflito EXPLÍCITO,
      // nunca escolha silenciosa (D-J).
      if (incompleteCacheEvidence) {
        const conflict = detectPostalEvidenceConflict(evidence);
        if (conflict) return { status: conflict, providerEvidence: evidence };
      }
      source = fresh.source;
    }

    // 5. Canonicalização contra o Location Core. Se a fonte era CACHE e o Core a rejeitou,
    //    o cache é DESCARTADO (D-I) e a resolução refaz com consulta fresca — o Core prevalece.
    const first = await this.canonicalize(country, postalCode, source, evidence);
    if (first.kind === 'resolution') {
      if (first.resolution.status !== 'resolved' && source.fromCache) {
        const fresh = await this.queryFreshProviders(country, postalCode, evidence);
        if (fresh.kind === 'failure') return { status: fresh.status, providerEvidence: evidence };
        const second = await this.canonicalize(country, postalCode, fresh.source, evidence);
        return second.resolution;
      }
      return first.resolution;
    }
    return first.resolution;
  }

  private mkEvidence(
    country: ResolvedCountry,
    postalCode: string,
    provider: PostalProviderId,
    outcome: PostalProviderEvidence['outcome'],
    data: PostalProviderAddressData | null,
    cacheHit: boolean
  ): PostalProviderEvidence {
    return {
      provider,
      countryCode: country.isoAlpha2,
      postalCodeNormalized: postalCode,
      queriedAt: this.now().toISOString(),
      outcome,
      officialCityCode: data?.officialCityCode ?? null,
      stateCode: data?.stateCode ?? null,
      responseHash: data ? evidenceHash(data.stateCode, data.cityName, data.officialCityCode) : null,
      cacheHit,
    };
  }

  /**
   * Consulta a chain governada em ordem server-side. Fallback SÓ por indisponibilidade;
   * not_found/malformado param a chain com estado explícito (nunca mascarados).
   */
  private async queryFreshProviders(
    country: ResolvedCountry,
    postalCode: string,
    evidence: PostalProviderEvidence[]
  ): Promise<FreshQueryOutcome> {
    const chain = this.providerChain();
    for (const adapter of chain) {
      const result = await adapter.query(postalCode);
      evidence.push(this.mkEvidence(country, postalCode, adapter.providerId, result.outcome, result.data, false));
      if (result.outcome === 'resolved' && result.data) {
        return { kind: 'source', source: { data: result.data, provider: adapter.providerId, fromCache: false } };
      }
      if (result.outcome === 'not_found') return { kind: 'failure', status: 'provider_not_found' };
      if (result.outcome === 'malformed') return { kind: 'failure', status: 'malformed_provider_response' };
      // 'unavailable' → único caso que autoriza o próximo adapter da chain.
    }
    return { kind: 'failure', status: 'provider_unavailable' };
  }

  /**
   * Resolve a fonte (cache utilizável ou fresca) contra o Location Core e monta o contrato.
   * NUNCA cria nada; cidade ausente/incoerente vira estado explícito fail-closed.
   */
  private async canonicalize(
    country: ResolvedCountry,
    postalCode: string,
    source: PostalSource,
    evidence: PostalProviderEvidence[]
  ): Promise<{ kind: 'resolution'; resolution: PostalAddressResolution }> {
    const fail = (status: PostalResolutionFailureStatus): { kind: 'resolution'; resolution: PostalAddressResolution } => ({
      kind: 'resolution',
      resolution: { status, providerEvidence: evidence },
    });

    const { data } = source;
    if (!data.stateCode || !data.cityName) return fail('malformed_provider_response');
    // 5a. Identificador oficial é OBRIGATÓRIO (D-C/D-D): sem ele, NUNCA resolver city por nome.
    if (!data.officialCityCode) return fail('official_identifier_missing');

    // 5b. state por país + UF governada (evidência é verificação; sem findOrCreateState, D-F).
    const state = await this.repo.findStateByCountryAndUf(country.id, data.stateCode);
    if (!state) return fail('territorial_inconsistency');

    // 5c. city pelo par ESCOPADO (state_id, external_code) — identidade oficial da Fase B (D-C).
    const cities = await this.repo.findCitiesByStateAndOfficialCode(state.id, data.officialCityCode);
    if (cities.length > 1) return fail('canonical_city_ambiguous');
    const city = cities.length === 1 && cities[0] && cities[0].isActive ? cities[0] : null;
    if (!city) {
      // Código existente em OUTRA jurisdição do país → UF da evidência contradiz o catálogo.
      const codeExistsElsewhere = await this.repo.existsCityWithOfficialCodeInCountry(country.id, data.officialCityCode);
      if (codeExistsElsewhere) return fail('territorial_inconsistency');
      // D-D: cidade honesta e explicitamente AUSENTE do catálogo — NUNCA INSERT/findOrCreate.
      return fail('canonical_city_missing');
    }

    // 5d. Bairro (D-G): alias governado vigente na MESMA city → identidade; nome canônico
    //     coincidente na MESMA city → CANDIDATO (exige confirmação); senão pending/not_applicable.
    let neighborhoodId: string | null = null;
    let neighborhoodCandidateId: string | null = null;
    let neighborhoodStatus: PostalNeighborhoodStatus;
    const providerNeighborhoodText = data.neighborhoodText;
    if (!providerNeighborhoodText) {
      neighborhoodStatus = 'not_applicable';
    } else {
      const aliasMatches = await this.repo.findNeighborhoodAliasMatchesInCity(city.id, providerNeighborhoodText);
      if (aliasMatches.length === 1 && aliasMatches[0]) {
        neighborhoodId = aliasMatches[0].id;
        neighborhoodStatus = 'resolved';
      } else if (aliasMatches.length > 1) {
        neighborhoodStatus = 'pending'; // alias ambíguo nunca resolve nem sugere silenciosamente
      } else {
        const candidates = await this.repo.findNeighborhoodCandidatesByNameInCity(city.id, providerNeighborhoodText);
        if (candidates.length === 1 && candidates[0]) {
          neighborhoodCandidateId = candidates[0].id;
          neighborhoodStatus = 'candidate_requires_confirmation';
        } else {
          neighborhoodStatus = 'pending';
        }
      }
    }

    // 5e. Cache derivado (D-I): persiste SÓ consulta fresca BR (cura inclusive cache descartado),
    //     best-effort, sem payload bruto/coords, nunca provider de teste.
    if (!source.fromCache && country.isoAlpha2 === 'BR' && source.provider !== 'mock') {
      try {
        await this.repo.storeCachedResolution({
          postalCode,
          provider: source.provider === 'viacep' ? 'VIA_CEP' : 'BRASIL_API',
          stateCode: data.stateCode,
          cityName: data.cityName,
          cityExternalCode: data.officialCityCode,
          neighborhoodName: providerNeighborhoodText,
          street: data.street,
          rawResponseHash: evidenceHash(data.stateCode, data.cityName, data.officialCityCode),
        });
      } catch {
        // cache é derivado/best-effort: falha de cache nunca degrada a resolução.
      }
    }

    return {
      kind: 'resolution',
      resolution: {
        status: 'resolved',
        countryId: country.id,
        stateId: state.id,
        cityId: city.id,
        neighborhoodId,
        neighborhoodCandidateId,
        neighborhoodStatus,
        postalCodeNormalized: postalCode,
        street: data.street,
        neighborhoodDisplayText: providerNeighborhoodText,
        cityDisplayText: city.name, // nome CANÔNICO do Location Core prevalece sobre o texto do provider
        stateDisplayText: state.abbreviation,
        providerEvidence: evidence,
        requiresUserConfirmation: true,
      },
    };
  }
}

export const postalAddressResolverService = new PostalAddressResolverService();
