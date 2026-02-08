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

/**
 * Tipos de linha do banco de dados
 */
export interface CountryRow {
  country_id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface StateRow {
  state_id: string;
  country_id: string;
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







