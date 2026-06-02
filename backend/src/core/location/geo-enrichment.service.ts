// src/core/location/geo-enrichment.service.ts
// F-GEO-1a (DECISION-0077): enriquecimento geográfico canônico do Location Core a partir de CEP.
//
// 🔴 Substrato COMPARTILHÁVEL (PF e PJ usam o mesmo trilho). NÃO é frente PJ/Perfil.
// 🔴 Estratégia B+D+C: state_id por UF (B); cidade por external_code IBGE (D); cria cidade sob demanda
//    quando o IBGE existe e a cidade não está no catálogo (C). Sem IBGE → NÃO inventa cidade (sem match
//    frágil por nome) — enriquece só state_id.
// 🔴 fail-open: falha/timeout do provider, UF fora do catálogo, ou ausência de IBGE → resultado controlado;
//    NUNCA derruba a escrita do endereço (que já é CEP-âncora).
// 🔴 Privacidade (DECISION-0077 §3): NÃO persiste lat/lng no endereço (coords de CEP podem ser precisas da
//    residência). Geo coarse = centroide da cidade via FK city_id. Coordenadas do provider são ignoradas aqui.
// 🔴 NÃO cria neighborhood (catálogo=0; bairro é residual via blob). NÃO toca actor_active_location.

import { locationRepository } from './location.repository';
import { getDefaultCepProvider, normalizePostalCode, type CepProvider } from './cep-provider';

export interface EnrichAddressResult {
  enriched: boolean;
  stateId?: string | null;
  cityId?: string | null;
  reason: string;
}

export class GeoEnrichmentService {
  constructor(private provider: CepProvider = getDefaultCepProvider()) {}

  /** Injeção de provider (testes/probe sem rede; ou troca de provider em runtime). */
  setProvider(provider: CepProvider): void {
    this.provider = provider;
  }

  /** Resolução PURA do CEP (sem escrita). null se inválido/não resolvido. */
  async resolvePostalCode(postalCode: string) {
    const cep = normalizePostalCode(postalCode);
    if (!cep) return null;
    try {
      return await this.provider.resolvePostalCode(cep);
    } catch {
      return null; // fail-open
    }
  }

  /**
   * Enriquece um `addresses` (state_id/city_id canônicos) a partir do seu CEP. Best-effort/fail-open.
   * NÃO escreve lat/lng. NÃO cria neighborhood. Idempotente: reusa cidade por external_code.
   */
  async enrichAddress(addressId: string, postalCode: string | null | undefined): Promise<EnrichAddressResult> {
    const cep = normalizePostalCode(postalCode);
    if (!cep) return { enriched: false, reason: 'cep_invalido' };

    const resolution = await this.resolvePostalCode(cep);
    if (!resolution) return { enriched: false, reason: 'nao_resolvido_fail_open' };

    const country = await locationRepository.findCountryByCode('BR');
    if (!country) return { enriched: false, reason: 'pais_br_ausente' };

    const state = await locationRepository.findStateByCode(country.id, resolution.stateCode);
    if (!state) return { enriched: false, reason: 'uf_fora_do_catalogo' };

    // C — cidade por IBGE (sob demanda). Sem IBGE: não inventa cidade (B = state-only).
    let cityId: string | null = null;
    if (resolution.cityExternalCode) {
      const existing = await locationRepository.findCityByExternalCode(resolution.cityExternalCode);
      const city =
        existing ??
        (await locationRepository.createCityFromExternal({
          stateId: state.id,
          name: resolution.cityName,
          externalCode: resolution.cityExternalCode,
          // lat/lng do centroide ficam para etapa de catálogo; NÃO usar coords de CEP (privacidade).
          lat: null,
          lng: null,
        }));
      cityId = city.id;
    }

    await locationRepository.updateAddressGeo(addressId, {
      stateId: state.id,
      cityId,
      source: 'CEP_RESOLVED',
    });

    return {
      enriched: true,
      stateId: state.id,
      cityId,
      reason: cityId ? 'state_and_city' : 'state_only_sem_ibge',
    };
  }
}

export const geoEnrichmentService = new GeoEnrichmentService();
