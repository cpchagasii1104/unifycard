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







