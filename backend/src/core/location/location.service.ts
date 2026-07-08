// src/core/location/location.service.ts
// Location Core - Service (lógica de negócio)

import { locationRepository } from './location.repository';
import type { Country, State, City, Neighborhood, LocationRef } from './location.types';
import { validateLocationRef } from './location.validators';

class LocationService {
  /**
   * Listar todos os países ativos
   */
  async getCountries(): Promise<Country[]> {
    return locationRepository.findAllCountries();
  }

  /**
   * Buscar país por ID
   */
  async getCountryById(countryId: string): Promise<Country | null> {
    return locationRepository.findCountryById(countryId);
  }

  /**
   * Listar estados de um país
   * Valida que o país existe antes de buscar estados
   */
  async getStatesByCountry(countryId: string): Promise<State[]> {
    // Validar que o país existe
    const country = await locationRepository.findCountryById(countryId);
    if (!country) {
      throw new Error(`País não encontrado: ${countryId}`);
    }

    return locationRepository.findStatesByCountry(countryId);
  }

  /**
   * Buscar estado por ID
   */
  async getStateById(stateId: string): Promise<State | null> {
    return locationRepository.findStateById(stateId);
  }

  /**
   * Listar cidades de um estado
   * Valida que o estado existe antes de buscar cidades
   */
  async getCitiesByState(stateId: string): Promise<City[]> {
    // Validar que o estado existe
    const state = await locationRepository.findStateById(stateId);
    if (!state) {
      throw new Error(`Estado não encontrado: ${stateId}`);
    }

    return locationRepository.findCitiesByState(stateId);
  }

  /** Busca cidade por texto (combobox governado de localização). Backend é a autoridade da lista. */
  async searchCities(q: string): Promise<Array<{ id: string; name: string; stateUf: string | null }>> {
    return locationRepository.searchCities(q);
  }

  /** Cidade governada mais próxima de um lat/lng (haversine). Verdade de localização no backend. */
  async findNearestCity(lat: number, lng: number): Promise<{ id: string; name: string; stateUf: string | null } | null> {
    return locationRepository.findNearestCity(lat, lng);
  }

  /**
   * AUTOCOMPLETE de CEP (transversal a toda locação). O CEP é UX/entrada auxiliar — a VERDADE é o
   * Location Core: mapeia cidade→city_id (IBGE se houver, senão nome+UF) e bairro→neighborhoodId (SSOT)
   * ou neighborhoodDisplay (só exibição). O front NUNCA grava city TEXT. Rua/bairro voltam como texto de
   * PREENCHIMENTO, confirmados/completados pelo usuário; o gravar mora no assign do recurso. Fail-open:
   * provider indisponível → resolved:false (o front pede a cidade no picker governado).
   */
  async resolveCep(rawCep: string): Promise<{
    resolved: boolean; postalCode: string | null; street: string | null;
    neighborhoodDisplay: string | null; neighborhoodId: string | null;
    cityId: string | null; cityName: string | null; stateUf: string | null; source: string | null;
  }> {
    const { normalizePostalCode, getDefaultCepProvider } = await import('./cep-provider');
    const empty = { resolved: false, postalCode: null, street: null, neighborhoodDisplay: null, neighborhoodId: null, cityId: null, cityName: null, stateUf: null, source: null };
    const cep = normalizePostalCode(rawCep);
    if (!cep) return empty;
    let res;
    try { res = await getDefaultCepProvider().resolvePostalCode(cep); } catch { res = null; }
    if (!res) return { ...empty, postalCode: cep };

    // cidade → city_id canônico: 1º IBGE (external_code), senão nome + UF entre as governadas.
    let city: { id: string; name: string } | null = null;
    if (res.cityExternalCode) {
      const c = await locationRepository.findCityByExternalCode(res.cityExternalCode);
      if (c) city = { id: c.id, name: c.name };
    }
    if (!city && res.cityName) {
      const matches = await locationRepository.searchCities(res.cityName);
      const m = matches.find((x) => (x.stateUf ?? '').toUpperCase() === (res.stateCode ?? '').toUpperCase());
      if (m) city = { id: m.id, name: m.name };
    }

    // bairro → neighborhoodId (SSOT) se casar na cidade; senão só display-text.
    let neighborhoodId: string | null = null;
    if (city && res.neighborhoodName) {
      const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
      const hoods = await locationRepository.findNeighborhoodsByCity(city.id);
      const h = hoods.find((x) => norm(x.name) === norm(res.neighborhoodName!));
      if (h) neighborhoodId = h.id;
    }

    return {
      resolved: true, postalCode: cep, street: res.street ?? null,
      neighborhoodDisplay: res.neighborhoodName ?? null, neighborhoodId,
      cityId: city?.id ?? null, cityName: city?.name ?? res.cityName ?? null,
      stateUf: res.stateCode ?? null, source: res.source ?? null,
    };
  }

  /**
   * Buscar cidade por ID
   */
  async getCityById(cityId: string): Promise<City | null> {
    return locationRepository.findCityById(cityId);
  }

  /**
   * Listar bairros de uma cidade
   * Valida que a cidade existe antes de buscar bairros
   */
  async getNeighborhoodsByCity(cityId: string): Promise<Neighborhood[]> {
    // Validar que a cidade existe
    const city = await locationRepository.findCityById(cityId);
    if (!city) {
      throw new Error(`Cidade não encontrada: ${cityId}`);
    }

    return locationRepository.findNeighborhoodsByCity(cityId);
  }

  /**
   * Buscar bairro por ID
   */
  async getNeighborhoodById(neighborhoodId: string): Promise<Neighborhood | null> {
    return locationRepository.findNeighborhoodById(neighborhoodId);
  }

  /**
   * Validar referência de localização
   * Helper reutilizável para outros módulos
   */
  async validateLocation(location: LocationRef): Promise<void> {
    await validateLocationRef(location);
  }
}

export const locationService = new LocationService();







