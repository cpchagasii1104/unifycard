// src/core/location/geo-enrichment.service.ts
// F-GEO-1a (DECISION-0077) + FASE B (RFC B1-D): enriquecimento geográfico de `addresses` a partir
// de CEP — agora DELEGADO ao resolver postal canônico (stack única).
//
// 🔴 FASE B (D-D/D-K): a criação de cidade sob demanda (`createCityFromExternal`) foi ABOLIDA.
//    Cidade ausente do catálogo canônico → `canonical_city_missing` (fail-closed, honesto) e o
//    endereço permanece CEP-âncora — NUNCA INSERT em cities/states a partir de provider.
// 🔴 Papel PRÉ-EXISTENTE preservado sem ampliação: este serviço só atualiza state_id/city_id de
//    um `addresses` já criado pelo writer legado do fluxo de residência (best-effort/fail-open —
//    nunca derruba a escrita do endereço). NÃO cria address/assignment, NÃO toca actor-scoped
//    (Fase C), NÃO cria neighborhood, NÃO toca actor_active_location.
// 🔴 Privacidade (DECISION-0077 §3): NÃO persiste lat/lng no endereço.
// 🔴 A resolução (país explícito 'BR' no call-site, cache-first, provider governado, identidade
//    oficial state+IBGE) mora INTEIRA no postal-address-resolver.service — sem 2ª stack aqui.

import { locationRepository } from './location.repository';
import {
  postalAddressResolverService,
  PostalAddressResolverService,
} from './postal-address-resolver.service';

export interface EnrichAddressResult {
  enriched: boolean;
  stateId?: string | null;
  cityId?: string | null;
  reason: string;
}

export class GeoEnrichmentService {
  constructor(private readonly resolver: PostalAddressResolverService = postalAddressResolverService) {}

  /**
   * Enriquece um `addresses` (state_id/city_id canônicos) a partir do seu CEP. Best-effort e
   * fail-open para o caller (nunca lança): qualquer estado não-resolvido vira `enriched:false`
   * com a razão explícita do resolver canônico (ex.: canonical_city_missing).
   */
  async enrichAddress(addressId: string, postalCode: string | null | undefined): Promise<EnrichAddressResult> {
    let resolution;
    try {
      resolution = await this.resolver.resolve({
        countryCode: 'BR', // fluxo legado brasileiro — país explícito no call-site (D-B)
        postalCode: postalCode ?? '',
      });
    } catch {
      return { enriched: false, reason: 'resolver_error_fail_open' };
    }
    if (resolution.status !== 'resolved') {
      return { enriched: false, reason: resolution.status };
    }

    await locationRepository.updateAddressGeo(addressId, {
      stateId: resolution.stateId,
      cityId: resolution.cityId,
      source: 'CEP_RESOLVED',
    });

    return {
      enriched: true,
      stateId: resolution.stateId,
      cityId: resolution.cityId,
      reason: 'state_and_city',
    };
  }
}

export const geoEnrichmentService = new GeoEnrichmentService();
