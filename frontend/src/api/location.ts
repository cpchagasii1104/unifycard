// src/api/location.ts
// API do Location Core - Fonte única de localização

import { apiFetch } from './client';

export interface Country {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface State {
  id: string;
  countryId: string;
  code: string;
  name: string;
}

export interface City {
  id: string;
  stateId: string;
  name: string;
}

export interface Neighborhood {
  id: string;
  cityId: string;
  name: string;
}

/**
 * Buscar todos os países ativos
 * GET /locations/countries
 */
export async function getCountries(): Promise<Country[]> {
  try {
    const response = await apiFetch('/locations/countries', {}, { silent404: true, silent401: true });
    if (!response.ok) {
      if (response.status >= 500) {
        console.error('[Location] Erro do servidor ao buscar países:', response.status, response.statusText);
      }
      return [];
    }
    const data = await response.json();
    return data.countries || [];
  } catch (error) {
    console.error('[Location] Erro ao buscar países:', error);
    return [];
  }
}

/**
 * Buscar estados de um país
 * GET /locations/states?country_id=UUID
 */
export async function getStatesByCountry(countryId: string): Promise<State[]> {
  try {
    const response = await apiFetch(
      `/locations/states?country_id=${encodeURIComponent(countryId)}`,
      {},
      { silent404: true, silent401: true }
    );
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.states || [];
  } catch (error) {
    console.warn('[Location] Erro ao buscar estados:', error);
    return [];
  }
}

/**
 * Buscar cidades de um estado
 * GET /locations/cities?state_id=UUID
 */
export async function getCitiesByState(stateId: string): Promise<City[]> {
  try {
    const response = await apiFetch(
      `/locations/cities?state_id=${encodeURIComponent(stateId)}`,
      {},
      { silent404: true, silent401: true }
    );
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.cities || [];
  } catch (error) {
    console.warn('[Location] Erro ao buscar cidades:', error);
    return [];
  }
}

/**
 * Busca cidade por TEXTO (combobox governado de localização). Backend é a autoridade da lista —
 * o front nunca inventa cidade nem usa texto digitado como verdade. GET /locations/cities/search?q=
 */
export interface CitySearchResult { id: string; name: string; stateUf: string | null }
export async function searchCities(q: string): Promise<CitySearchResult[]> {
  try {
    const response = await apiFetch(
      `/locations/cities/search?q=${encodeURIComponent(q ?? '')}`,
      {},
      { silent404: true, silent401: true }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.cities || [];
  } catch {
    return [];
  }
}

/**
 * Cidade mais próxima de um lat/lng — o navegador capta o sensor, o BACKEND resolve qual cidade.
 * GET /locations/cities/nearest?lat=&lng= . Retorna null se nada resolver (fallback: digitar a cidade).
 */
export async function findNearestCity(lat: number, lng: number): Promise<CitySearchResult | null> {
  try {
    const response = await apiFetch(
      `/locations/cities/nearest?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
      {},
      { silent404: true, silent401: true }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.city ?? null;
  } catch {
    return null;
  }
}

/**
 * Autocomplete de CEP (transversal a toda locação). O backend resolve e mapeia para o Location Core;
 * o front só preenche. A verdade é cityId/neighborhoodId — nunca o texto. resolved:false = pedir cidade.
 * GET /locations/cep/:cep
 */
export interface CepAutocomplete {
  resolved: boolean;
  postalCode: string | null;
  street: string | null;
  neighborhoodDisplay: string | null;
  neighborhoodId: string | null;
  cityId: string | null;
  cityName: string | null;
  stateUf: string | null;
  source: string | null;
}
export async function resolveCep(cep: string): Promise<CepAutocomplete | null> {
  try {
    const response = await apiFetch(`/locations/cep/${encodeURIComponent(cep)}`, {}, { silent404: true, silent401: true });
    if (!response.ok) return null;
    const data = await response.json();
    return data.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Buscar bairros de uma cidade
 * GET /locations/neighborhoods?city_id=UUID
 */
export async function getNeighborhoodsByCity(cityId: string): Promise<Neighborhood[]> {
  try {
    const response = await apiFetch(
      `/locations/neighborhoods?city_id=${encodeURIComponent(cityId)}`,
      {},
      { silent404: true, silent401: true }
    );
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.neighborhoods || [];
  } catch (error) {
    console.warn('[Location] Erro ao buscar bairros:', error);
    return [];
  }
}

