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

