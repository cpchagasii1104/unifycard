// src/core/location/feed-proximity.types.ts
// DECISION-0030 — Localização contextual de actor (F2 do plano feed geo)
//
// Tipos compartilhados entre repository + service + endpoint.
// Naming "feed-proximity" reforça fricção semântica de DECISION-0030 anti-padrão #1:
// service NÃO é genérico para todos os módulos. Rides/delivery/marketplace TÊM
// services próprios com regras distintas (constraint físico ≠ preferência de feed).

/** Origem da localização ativa do actor */
export type ActorActiveLocationSource =
  | 'USER_INPUT_CITY'       // user escolheu cidade no dropdown
  | 'BROWSER_GEOLOCATION'   // W3C Geolocation API
  | 'IP_ESTIMATE'           // inferência por IP (menos precisa)
  | 'EXPLICIT_TRAVEL_MODE'; // "estou viajando em X"

/** Granularidade da localização ativa */
export type ActorActiveLocationScopeLevel =
  | 'NEIGHBORHOOD'
  | 'CITY'
  | 'STATE'
  | 'COUNTRY';

/** Row em actor_active_location */
export interface ActorActiveLocation {
  id: string;
  tenantId: string;
  actorId: string;
  addressId: string | null;
  lat: number | null;
  lng: number | null;
  source: ActorActiveLocationSource;
  scopeLevel: ActorActiveLocationScopeLevel | null;
  activatedAt: string;
  expiresAt: string | null;
  isActive: boolean;
  metadata: Record<string, any>;
  createdAt: string;
}

/** Input para set de localização ativa */
export interface SetActorActiveLocationInput {
  /** Pelo menos um obrigatório (CHECK no DB) */
  addressId?: string | null;
  lat?: number | null;
  lng?: number | null;
  source: ActorActiveLocationSource;
  scopeLevel?: ActorActiveLocationScopeLevel;
  expiresAt?: string | null;
  metadata?: Record<string, any>;
}

/** Localização hidratada com hierarquia administrativa (para queries de scope=city/state) */
export interface ActorActiveLocationHydrated extends ActorActiveLocation {
  cityId: string | null;
  stateId: string | null;
  countryId: string | null;
}

/** Scope do filtro de feed por proximidade */
export type FeedProximityScope =
  | 'radius_km'
  | 'city'
  | 'state'
  | 'unlimited';

/** Input do filtro de feed por proximidade */
export interface FeedProximityFilterInput {
  scope: FeedProximityScope;
  /** Necessário quando scope='radius_km'; ignorado nos demais */
  value?: number;
  /** Quando true, inclui posts.address_id IS NULL nos resultados */
  includeGlobal: boolean;
}

/** Resultado do resolver de scope — fragmento SQL a aplicar no WHERE do feed */
export interface FeedProximityFilterResolved {
  /** SQL fragment para WHERE (ex: "p.address_id IN (SELECT...) OR p.address_id IS NULL") */
  sqlFragment: string;
  /** Parâmetros posicionais correspondentes (Postgres $1, $2...) */
  params: unknown[];
  /** Resumo legível para logs/observability */
  description: string;
  /** Quando true, sinaliza que user não tem localização ativa e fallback foi aplicado */
  fallbackApplied: 'NO_LOCATION' | 'EMPTY_RESULT' | null;
}
