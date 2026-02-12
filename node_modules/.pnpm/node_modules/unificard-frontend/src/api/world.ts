// src/api/world.ts
// API de dados geográficos (países, estados, cidades)

import { apiFetch } from './client';

export interface Country {
  countryId: string;
  name: string;
  code: string;
}

export interface State {
  stateId: string;
  name: string;
  code: string;
  countryId: string;
}

export interface City {
  cityId: string;
  name: string;
  stateId: string;
  countryId: string;
}

/**
 * Buscar todos os países
 * GET /world/countries
 */
export async function getCountries(): Promise<Country[]> {
  try {
    const response = await apiFetch('/world/countries', {}, { silent404: true });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('[World] Erro ao buscar países:', error);
    return [];
  }
}

/**
 * Buscar estados de um país
 * GET /world/countries/:countryId/states
 */
export async function getStatesByCountry(countryId: string): Promise<State[]> {
  try {
    const response = await apiFetch(`/world/countries/${countryId}/states`, {}, { silent404: true });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('[World] Erro ao buscar estados:', error);
    return [];
  }
}

/**
 * Buscar cidades de um estado
 * GET /world/states/:stateId/cities
 */
export async function getCitiesByState(stateId: string): Promise<City[]> {
  try {
    const response = await apiFetch(`/world/states/${stateId}/cities`, {}, { silent404: true });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('[World] Erro ao buscar cidades:', error);
    return [];
  }
}







