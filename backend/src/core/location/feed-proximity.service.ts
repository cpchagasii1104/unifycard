// src/core/location/feed-proximity.service.ts
// DECISION-0030 — Localização contextual de actor (F2 do plano feed geo)
//
// Service que resolve filtro de proximidade para o feed de posts.
//
// IMPORTANTE — DECISION-0030 anti-padrão #1:
//   Service NÃO é genérico para módulos operacionais (rides/delivery/marketplace).
//   Naming "feed-proximity" cria fricção semântica protetora.
//   Quando rides/delivery precisarem de lógica espacial, cada um cria SEU service
//   (ride-coverage.service, delivery-zone.service, marketplace-shipping.service),
//   consumindo actor_active_location como fonte mas com regras próprias.
//
// Princípio "Frontend nunca cria verdade" (memória 2026-05-19):
//   Frontend envia {scope, value, includeGlobal}; backend resolve raio inteiro.
//   Frontend NUNCA calcula distância localmente.

import { actorActiveLocationRepository } from './actor-active-location.repository';
import type {
  FeedProximityFilterInput,
  FeedProximityFilterResolved,
} from './feed-proximity.types';

class FeedProximityService {
  /**
   * Resolve o filtro de proximidade do feed para um actor.
   *
   * Retorna fragmento SQL + parâmetros para aplicar em WHERE clause de query de posts.
   * Caller (feed query builder) é responsável por anexar e preservar ordem de parâmetros.
   *
   * @param tenantId tenant do request
   * @param actorId actor ativo do request
   * @param input  filtro de proximidade enviado pelo frontend
   * @param paramOffset offset inicial dos parâmetros $N (caller pode ter $1, $2 já usados)
   */
  async resolveFilter(
    tenantId: string,
    actorId: string,
    input: FeedProximityFilterInput,
    paramOffset = 0
  ): Promise<FeedProximityFilterResolved> {
    const { scope, value, includeGlobal } = input;

    switch (scope) {
      case 'unlimited':
        // Sem filtro geo. Só tenant isolation (caller já filtra).
        return {
          sqlFragment: 'TRUE',
          params: [],
          description: 'scope=unlimited (sem filtro geo)',
          fallbackApplied: null,
        };

      case 'radius_km': {
        if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
          throw new Error('feed-proximity: scope=radius_km requires value > 0 (km)');
        }
        const userLoc = await actorActiveLocationRepository.getActive(tenantId, actorId);
        if (!userLoc || userLoc.lat === null || userLoc.lng === null) {
          return this.fallbackNoLocation(includeGlobal);
        }
        return this.buildHaversineFilter(userLoc.lat, userLoc.lng, value, includeGlobal, paramOffset);
      }

      case 'city': {
        const hydrated = await actorActiveLocationRepository.getActiveHydrated(tenantId, actorId);
        if (!hydrated || !hydrated.cityId) {
          return this.fallbackNoLocation(includeGlobal);
        }
        return this.buildCityFilter(hydrated.cityId, includeGlobal, paramOffset);
      }

      case 'state': {
        const hydrated = await actorActiveLocationRepository.getActiveHydrated(tenantId, actorId);
        if (!hydrated || !hydrated.stateId) {
          return this.fallbackNoLocation(includeGlobal);
        }
        return this.buildStateFilter(hydrated.stateId, includeGlobal, paramOffset);
      }

      default: {
        const exhaustive: never = scope;
        throw new Error(`feed-proximity: scope inválido: ${exhaustive}`);
      }
    }
  }

  /**
   * Fallback quando user não tem localização ativa (ou não tem dados suficientes para scope).
   * - includeGlobal=true → retorna apenas posts globais (address_id IS NULL)
   * - includeGlobal=false → retorna nada (sinaliza UI para pedir ativação de localização)
   */
  private fallbackNoLocation(includeGlobal: boolean): FeedProximityFilterResolved {
    if (includeGlobal) {
      return {
        sqlFragment: 'p.address_id IS NULL',
        params: [],
        description: 'fallback: sem localização ativa, mostrando apenas posts globais',
        fallbackApplied: 'NO_LOCATION',
      };
    }
    return {
      sqlFragment: 'FALSE', // resultado vazio explícito
      params: [],
      description: 'fallback: sem localização ativa e includeGlobal=false → resultado vazio',
      fallbackApplied: 'EMPTY_RESULT',
    };
  }

  /**
   * Filtro Haversine SQL puro (Sub-decisão A de DECISION-0030).
   *
   * Estratégia: bounding box pré-filtro (usa index) + haversine_distance_km fino.
   *
   * deltaLat = radius_km / 111 (graus aproximados por km, válido globalmente)
   * deltaLng = radius_km / (111 * cos(lat)) (mais largo perto da linha do equador)
   *
   * SQL fragment retornado pressupõe alias "p" para posts e JOIN com addresses "a"
   * via p.address_id = a.address_id realizado pelo caller.
   */
  private buildHaversineFilter(
    userLat: number,
    userLng: number,
    radiusKm: number,
    includeGlobal: boolean,
    offset: number
  ): FeedProximityFilterResolved {
    const deltaLat = radiusKm / 111;
    // cos(lat em radians) — proteger contra cos=0 perto dos polos com max(0.01)
    const deltaLng = radiusKm / (111 * Math.max(0.01, Math.cos((userLat * Math.PI) / 180)));

    const minLat = userLat - deltaLat;
    const maxLat = userLat + deltaLat;
    const minLng = userLng - deltaLng;
    const maxLng = userLng + deltaLng;

    const p1 = `$${offset + 1}`;
    const p2 = `$${offset + 2}`;
    const p3 = `$${offset + 3}`;
    const p4 = `$${offset + 4}`;
    const p5 = `$${offset + 5}`;
    const p6 = `$${offset + 6}`;
    const p7 = `$${offset + 7}`;

    const params: unknown[] = [minLat, maxLat, minLng, maxLng, userLat, userLng, radiusKm];

    const fragment = `
      p.address_id IN (
        SELECT a.address_id FROM addresses a
        WHERE a.lat IS NOT NULL AND a.lng IS NOT NULL
          AND a.lat BETWEEN ${p1} AND ${p2}
          AND a.lng BETWEEN ${p3} AND ${p4}
          AND haversine_distance_km(a.lat, a.lng, ${p5}, ${p6}) <= ${p7}
      )
    `.trim();

    const combined = includeGlobal
      ? `(${fragment} OR p.address_id IS NULL)`
      : fragment;

    return {
      sqlFragment: combined,
      params,
      description: `scope=radius_km value=${radiusKm}km center=(${userLat},${userLng})${includeGlobal ? ' +globais' : ''}`,
      fallbackApplied: null,
    };
  }

  /**
   * Filtro por cidade: posts cujo address.city_id = user.city_id
   */
  private buildCityFilter(
    cityId: string,
    includeGlobal: boolean,
    offset: number
  ): FeedProximityFilterResolved {
    const $p1 = `$${offset + 1}`;
    const params: unknown[] = [cityId];

    const fragment = `
      p.address_id IN (
        SELECT a.address_id FROM addresses a WHERE a.city_id = ${$p1}
      )
    `.trim();

    const combined = includeGlobal
      ? `(${fragment} OR p.address_id IS NULL)`
      : fragment;

    return {
      sqlFragment: combined,
      params,
      description: `scope=city city_id=${cityId}${includeGlobal ? ' +globais' : ''}`,
      fallbackApplied: null,
    };
  }

  /**
   * Filtro por estado: posts cujo address.state_id = user.state_id
   */
  private buildStateFilter(
    stateId: string,
    includeGlobal: boolean,
    offset: number
  ): FeedProximityFilterResolved {
    const $p1 = `$${offset + 1}`;
    const params: unknown[] = [stateId];

    const fragment = `
      p.address_id IN (
        SELECT a.address_id FROM addresses a WHERE a.state_id = ${$p1}
      )
    `.trim();

    const combined = includeGlobal
      ? `(${fragment} OR p.address_id IS NULL)`
      : fragment;

    return {
      sqlFragment: combined,
      params,
      description: `scope=state state_id=${stateId}${includeGlobal ? ' +globais' : ''}`,
      fallbackApplied: null,
    };
  }
}

export const feedProximityService = new FeedProximityService();
