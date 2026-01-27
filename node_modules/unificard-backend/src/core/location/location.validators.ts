// src/core/location/location.validators.ts
// Location Core - Validadores reutilizáveis

import { locationRepository } from './location.repository';
import type { LocationRef } from './location.types';

/**
 * Erros de validação de localização
 */
export class LocationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocationValidationError';
  }
}

/**
 * Validar referência de localização completa
 * Garante que a hierarquia está correta: país → estado → cidade → bairro
 */
export async function validateLocationRef(location: LocationRef): Promise<void> {
  // Se não há nenhuma localização, é válido (opcional)
  if (!location.country_id && !location.state_id && !location.city_id && !location.neighborhood_id) {
    return;
  }

  // País é obrigatório se houver qualquer outra localização
  if (!location.country_id && (location.state_id || location.city_id || location.neighborhood_id)) {
    throw new LocationValidationError('País é obrigatório quando há estado, cidade ou bairro');
  }

  // Validar país existe
  if (location.country_id) {
    const country = await locationRepository.findCountryById(location.country_id);
    if (!country) {
      throw new LocationValidationError(`País não encontrado: ${location.country_id}`);
    }
  }

  // Estado é obrigatório se houver cidade ou bairro
  if (!location.state_id && (location.city_id || location.neighborhood_id)) {
    throw new LocationValidationError('Estado é obrigatório quando há cidade ou bairro');
  }

  // Validar estado existe e pertence ao país
  if (location.state_id) {
    if (!location.country_id) {
      throw new LocationValidationError('País é obrigatório quando há estado');
    }

    const state = await locationRepository.findStateById(location.state_id);
    if (!state) {
      throw new LocationValidationError(`Estado não encontrado: ${location.state_id}`);
    }

    const belongsToCountry = await locationRepository.validateStateBelongsToCountry(
      location.state_id,
      location.country_id
    );
    if (!belongsToCountry) {
      throw new LocationValidationError(`Estado ${location.state_id} não pertence ao país ${location.country_id}`);
    }
  }

  // Cidade é obrigatória se houver bairro
  if (!location.city_id && location.neighborhood_id) {
    throw new LocationValidationError('Cidade é obrigatória quando há bairro');
  }

  // Validar cidade existe e pertence ao estado
  if (location.city_id) {
    if (!location.state_id) {
      throw new LocationValidationError('Estado é obrigatório quando há cidade');
    }

    const city = await locationRepository.findCityById(location.city_id);
    if (!city) {
      throw new LocationValidationError(`Cidade não encontrada: ${location.city_id}`);
    }

    const belongsToState = await locationRepository.validateCityBelongsToState(
      location.city_id,
      location.state_id
    );
    if (!belongsToState) {
      throw new LocationValidationError(`Cidade ${location.city_id} não pertence ao estado ${location.state_id}`);
    }
  }

  // Validar bairro existe e pertence à cidade
  if (location.neighborhood_id) {
    if (!location.city_id) {
      throw new LocationValidationError('Cidade é obrigatória quando há bairro');
    }

    const neighborhood = await locationRepository.findNeighborhoodById(location.neighborhood_id);
    if (!neighborhood) {
      throw new LocationValidationError(`Bairro não encontrado: ${location.neighborhood_id}`);
    }

    const belongsToCity = await locationRepository.validateNeighborhoodBelongsToCity(
      location.neighborhood_id,
      location.city_id
    );
    if (!belongsToCity) {
      throw new LocationValidationError(
        `Bairro ${location.neighborhood_id} não pertence à cidade ${location.city_id}`
      );
    }
  }
}

/**
 * Validar apenas se os IDs existem (sem verificar hierarquia)
 * Útil para validações rápidas
 */
export async function validateLocationIdsExist(location: LocationRef): Promise<void> {
  if (location.country_id) {
    const country = await locationRepository.findCountryById(location.country_id);
    if (!country) {
      throw new LocationValidationError(`País não encontrado: ${location.country_id}`);
    }
  }

  if (location.state_id) {
    const state = await locationRepository.findStateById(location.state_id);
    if (!state) {
      throw new LocationValidationError(`Estado não encontrado: ${location.state_id}`);
    }
  }

  if (location.city_id) {
    const city = await locationRepository.findCityById(location.city_id);
    if (!city) {
      throw new LocationValidationError(`Cidade não encontrada: ${location.city_id}`);
    }
  }

  if (location.neighborhood_id) {
    const neighborhood = await locationRepository.findNeighborhoodById(location.neighborhood_id);
    if (!neighborhood) {
      throw new LocationValidationError(`Bairro não encontrado: ${location.neighborhood_id}`);
    }
  }
}







