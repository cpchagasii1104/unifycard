// src/core/location/postal-territorial-evidence.repository.ts
// FASE B (RFC B1-D) — leituras territoriais da resolução postal canônica. READ-ONLY sobre o
// Location Core (countries/states/cities/neighborhoods/aliases); a ÚNICA escrita permitida na
// Fase B é o cache derivado `cep_resolution_cache` (D-I), delegada aos métodos já existentes do
// location.repository (nenhuma segunda casa de cache).
//
// 🔴 city SÓ por identificador oficial ESCOPADO pela jurisdição (state_id + external_code) — nunca
//    por nome livre, nunca external_code nu como identidade global (D-C).
// 🔴 bairro: alias GOVERNADO vigente dentro da MESMA city pode resolver identidade (D-G);
//    coincidência de nome canônico dentro da MESMA city produz no máximo CANDIDATO
//    (neighborhoodCandidateId, exige confirmação humana) — o candidato NUNCA é gravado nem
//    atribuído a neighborhoodId por este arco. Este é o ÚNICO arquivo autorizado (allowlist por
//    caminho exato no guard audit-neighborhood-freetext-writer-containment) a consultar
//    neighborhoods por nome, e SOMENTE para sugerir candidato read-only.
// 🔴 NENHUM INSERT/UPDATE/DELETE em countries/states/cities/neighborhoods/addresses/assignments.

import { pool } from '@core/database/pool';
import { locationRepository, NEIGHBORHOOD_CURRENT_SQL } from './location.repository';
import type { CachedCepResolution } from './location.types';

export interface PostalCountryRow { id: string; isoAlpha2: string; name: string }
export interface PostalStateRow { id: string; abbreviation: string; name: string }
export interface PostalCityRow { id: string; stateId: string; name: string; isActive: boolean }
export interface PostalNeighborhoodRefRow { id: string; name: string }

export class PostalTerritorialEvidenceRepository {
  /** País canônico por ISO alpha-2 (ativo). */
  async findCountryByIsoAlpha2(isoAlpha2: string): Promise<PostalCountryRow | null> {
    const r = await pool.query<{ id: string; iso_alpha2: string; name: string }>(
      `SELECT country_id AS id, iso_alpha2, name
         FROM countries
        WHERE iso_alpha2 = $1 AND is_active = true
        LIMIT 1`,
      [isoAlpha2]
    );
    const row = r.rows[0];
    return row ? { id: row.id, isoAlpha2: row.iso_alpha2, name: row.name } : null;
  }

  /** Estado canônico por país + UF governada (evidência do provider é verificação, não criação). */
  async findStateByCountryAndUf(countryId: string, uf: string): Promise<PostalStateRow | null> {
    const r = await pool.query<{ id: string; abbreviation: string; name: string }>(
      `SELECT state_id AS id, abbreviation, name
         FROM states
        WHERE country_id = $1 AND abbreviation = $2
        LIMIT 1`,
      [countryId, uf]
    );
    return r.rows[0] ?? null;
  }

  /**
   * Cidades pelo par ESCOPADO (state_id, external_code) — a identidade oficial da Fase B (D-C).
   * LIMIT 2 para detectar ambiguidade estrutural (o índice uidx_cities_state_external_code
   * garante ≤1; a detecção é defesa-em-profundidade honesta, nunca first-row silencioso).
   */
  async findCitiesByStateAndOfficialCode(stateId: string, officialCode: string): Promise<PostalCityRow[]> {
    const r = await pool.query<{ id: string; state_id: string; name: string; is_active: boolean }>(
      `SELECT city_id AS id, state_id, name, is_active
         FROM cities
        WHERE state_id = $1 AND external_code = $2
        LIMIT 2`,
      [stateId, officialCode]
    );
    return r.rows.map((row) => ({ id: row.id, stateId: row.state_id, name: row.name, isActive: row.is_active }));
  }

  /**
   * CLASSIFICAÇÃO (não resolução): o código oficial existe em OUTRA jurisdição do mesmo país?
   * Usado apenas para distinguir `territorial_inconsistency` (código existe, UF não bate) de
   * `canonical_city_missing` (código não existe no catálogo). O resultado NUNCA vira cityId.
   */
  async existsCityWithOfficialCodeInCountry(countryId: string, officialCode: string): Promise<boolean> {
    const r = await pool.query<{ found: boolean }>(
      `SELECT EXISTS(
         SELECT 1
           FROM cities c
           JOIN states s ON s.state_id = c.state_id
          WHERE s.country_id = $1 AND c.external_code = $2
       ) AS found`,
      [countryId, officialCode]
    );
    return r.rows[0]?.found ?? false;
  }

  /**
   * Alias GOVERNADO vigente de bairro DENTRO da city resolvida (D-G). Só alias vigente + bairro
   * canônico vigente. LIMIT 2: alias ambíguo (2+ bairros distintos) nunca resolve identidade.
   */
  async findNeighborhoodAliasMatchesInCity(cityId: string, rawText: string): Promise<PostalNeighborhoodRefRow[]> {
    const r = await pool.query<{ id: string; name: string }>(
      `SELECT DISTINCT na.neighborhood_id AS id, n.name
         FROM neighborhood_aliases na
         JOIN neighborhoods n ON n.neighborhood_id = na.neighborhood_id
        WHERE n.city_id = $1
          AND na.alias_normalized = unaccent(lower(btrim($2)))
          AND na.is_active = true
          AND na.valid_from_at <= CURRENT_TIMESTAMP
          AND (na.valid_until_at IS NULL OR na.valid_until_at > CURRENT_TIMESTAMP)
          AND ${NEIGHBORHOOD_CURRENT_SQL}
        LIMIT 2`,
      [cityId, rawText]
    );
    return r.rows;
  }

  /**
   * CANDIDATO de bairro por coincidência de nome canônico DENTRO da MESMA city (GO §15.2 /
   * RFC B1-D D-G). Read-only: o retorno alimenta EXCLUSIVAMENTE neighborhoodCandidateId
   * (candidate_requires_confirmation) — nunca neighborhoodId, nunca persistência. "Centro" em
   * cidades diferentes jamais converge: o filtro city_id = $1 é estrutural. LIMIT 2: coincidência
   * ambígua não sugere candidato.
   */
  async findNeighborhoodCandidatesByNameInCity(cityId: string, rawText: string): Promise<PostalNeighborhoodRefRow[]> {
    const r = await pool.query<{ id: string; name: string }>(
      `SELECT n.neighborhood_id AS id, n.name
         FROM neighborhoods n
        WHERE n.city_id = $1
          AND ${NEIGHBORHOOD_CURRENT_SQL}
          AND n.name_normalized = unaccent(lower(btrim($2)))
        LIMIT 2`,
      [cityId, rawText]
    );
    return r.rows;
  }

  /** Cache derivado (D-I): leitura vigente. NUNCA decide cityId — o código é re-resolvido sempre. */
  async findCachedResolution(postalCodeNormalized: string): Promise<CachedCepResolution | null> {
    return locationRepository.findCepResolutionByPostalCode(postalCodeNormalized);
  }

  /** Cache derivado (D-I): upsert idempotente best-effort, SEM payload bruto/coords. Só BR usa a
   *  chave atual (postal_code sem país); países futuros exigem evolução própria da chave. */
  async storeCachedResolution(input: {
    postalCode: string;
    provider: string;
    stateCode: string | null;
    cityName: string | null;
    cityExternalCode: string | null;
    neighborhoodName: string | null;
    street: string | null;
    rawResponseHash: string | null;
  }): Promise<void> {
    await locationRepository.upsertCepResolution({ ...input, source: 'CEP_RESOLVED' });
  }
}

export const postalTerritorialEvidenceRepository = new PostalTerritorialEvidenceRepository();
