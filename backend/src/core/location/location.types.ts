// src/core/location/location.types.ts
// Location Core - Tipos TypeScript

/**
 * País
 */
export interface Country {
  id: string;
  code: string; // ISO 3166-1 alpha-2
  name: string;
  isActive: boolean;
}

/**
 * Estado/Província
 */
export interface State {
  id: string;
  countryId: string;
  code: string;
  name: string;
}

/**
 * Cidade
 */
export interface City {
  id: string;
  stateId: string;
  name: string;
}

/**
 * Bairro
 */
export interface Neighborhood {
  id: string;
  cityId: string;
  name: string;
}

/**
 * Referência de localização (objeto com IDs opcionais)
 * Usado para validar e referenciar localização em outros módulos
 */
export interface LocationRef {
  country_id?: string;
  state_id?: string;
  city_id?: string;
  neighborhood_id?: string;
}

/**
 * Localização completa (com nomes)
 */
export interface FullLocation {
  country?: Country;
  state?: State;
  city?: City;
  neighborhood?: Neighborhood;
}

export interface CreateAddressInput {
  countryId: string;
  stateId?: string | null;
  cityId?: string | null;
  neighborhoodId?: string | null;
  // F-GEO-4a (DECISION-0079): bairro como texto de exibição controlado (NÃO FK, NÃO SSOT territorial).
  neighborhoodDisplayText?: string | null;
  postalCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  reference?: string | null;
  source: 'UX_INPUT' | 'CEP_RESOLVED' | 'GEOCODED' | 'MANUAL_OVERRIDE' | 'IMPORT_LEGACY' | 'EXTERNAL_API';
  lat?: number | null;
  lng?: number | null;
}

export interface Address {
  id: string;
  countryId: string;
  stateId: string | null;
  cityId: string | null;
  neighborhoodId: string | null;
  postalCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  reference: string | null;
  source: string;
  isGeocoded: boolean;
  lat: number | null;
  lng: number | null;
  createdByTenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Vocabulário governado de owner_type (espelha EXATAMENTE a CHECK de address_assignments no banco).
// 'actor' (FASE A) = âncora territorial canônica FK-backed do Actor (residência/operacional/HQ).
// rentable_resource/actor_asset = owners legados de PICKUP (rentals) já vivos em SQL.
export type AddressOwnerType = 'company' | 'profile' | 'event' | 'ride' | 'group' | 'tenant_hq' | 'service_provider' | 'rentable_resource' | 'actor_asset' | 'actor';

export type AddressRole = 'BILLING' | 'DELIVERY' | 'RESIDENCE' | 'HQ' | 'OPERATIONAL' | 'PICKUP' | 'DROPOFF';

export interface AddressAssignment {
  id: string;
  ownerType: AddressOwnerType;
  ownerId: string;
  addressId: string;
  role: AddressRole;
  isPrimary: boolean;
  validFromAt: Date;
  validUntilAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tipos de linha do banco de dados
 */
export interface CountryRow {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface StateRow {
  id: string;
  countryId: string;
  code: string;
  name: string;
}

export interface CityRow {
  city_id: string;
  state_id: string;
  name: string;
}

export interface NeighborhoodRow {
  neighborhood_id: string;
  city_id: string;
  name: string;
}








/**
 * F-GEO-3 (DECISION-0074/0077): residência primária vigente com city/state resolvidos por FK
 * canônica (states/cities). Projeção de LEITURA para readers (ex.: core.service) exibirem
 * cidade/UF sem depender do blob. NÃO inclui bairro (catálogo de neighborhoods vazio — bairro
 * segue residual via blob nesta fase). NÃO inclui lat/lng (privacidade).
 */
export interface PrimaryResidenceGeo {
  addressId: string;
  postalCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  stateAbbreviation: string | null; // ex.: 'PR' (states.abbreviation; null se city/state não enriquecidos)
  stateName: string | null;         // ex.: 'Paraná'
  cityName: string | null;          // ex.: 'Curitiba' (cities.name)
  cityExternalCode: string | null;  // IBGE (cities.external_code)
  // F-GEO-4a (DECISION-0079): bairro de exibição controlado (addresses.neighborhood_display_text); NÃO FK.
  // Vazio até o F-GEO-4b migrar o bairro do blob; lido pelo core.service no F-GEO-4c.
  neighborhoodDisplayText: string | null;
}

/**
 * F-GEO-1b (DECISION-0078): linha de cache de resolução de CEP (insumo técnico, NÃO SSOT).
 * NÃO inclui lat/lng (privacidade — coords de CEP não são cacheadas).
 */
export interface CachedCepResolution {
  postalCode: string;
  provider: string;
  stateCode: string | null;
  cityName: string | null;
  cityExternalCode: string | null;
  neighborhoodName: string | null;
  street: string | null;
  source: string;
}
