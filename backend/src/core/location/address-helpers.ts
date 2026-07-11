// src/core/location/address-helpers.ts
// Location Core - Helpers para adaptação gradual de módulos existentes

import { pool } from '@core/database/pool';
import { locationRepository } from './location.repository';
import type { AddressRef, FullAddress } from './address.types';

/**
 * Converter endereço legado (texto solto) para AddressRef
 * Usado para migração gradual de módulos existentes
 */
export async function convertLegacyAddressToRef(input: {
  country?: string; // Código ou nome
  state?: string; // Sigla ou nome
  city?: string; // Nome
  neighborhood?: string; // Nome
}): Promise<AddressRef | null> {
  const ref: AddressRef = {};

  // País
  if (input.country) {
    // Tentar buscar por código primeiro
    const country = await locationRepository.findCountryByCode(input.country.toUpperCase());
    if (country) {
      ref.country_id = country.id;
    }
    // Se não encontrou, poderia buscar por nome normalizado (implementar se necessário)
  }

  // Estado
  if (input.state && ref.country_id) {
    // Tentar buscar por código (sigla)
    const state = await locationRepository.findStateByCode(ref.country_id, input.state.toUpperCase());
    if (state) {
      ref.state_id = state.id;
    }
    // Se não encontrou, poderia buscar por nome normalizado (implementar se necessário)
  }

  // Cidade
  if (input.city && ref.state_id) {
    // Buscar por nome (case-insensitive)
    const result = await pool.query<{ city_id: string }>(
      `
      SELECT city_id
      FROM cities
      WHERE state_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))
      LIMIT 1
      `,
      [ref.state_id, input.city]
    );

    if (result.rows.length > 0) {
      ref.city_id = result.rows[0].city_id;
    }
  }

  // Bairro — CONTENÇÃO N0.1 (DT-LOCATION-CORE-NEIGHBORHOOD-FREE-TEXT-WRITER):
  // NÃO resolver `neighborhood_id` por igualdade de nome. DECISION-0079 §6 (bairro nunca é
  // identidade por texto livre) + DECISION-0166 D4 (nível neighborhood em HOLD). O bairro de
  // entrada permanece só como texto de exibição no chamador; a resolução canônica de
  // `neighborhood_id` só existirá na fundação governada F-NEIGHBORHOOD-CANONICAL-IDENTITY.
  // País/estado/cidade acima seguem preservados.

  // Retornar null se não encontrou nada
  if (!ref.country_id && !ref.state_id && !ref.city_id && !ref.neighborhood_id) {
    return null;
  }

  return ref;
}

/**
 * Buscar endereço completo com nomes formatados
 */
export async function getFullAddress(ref: AddressRef): Promise<FullAddress | null> {
  const full: FullAddress = {};

  if (ref.country_id) {
    const country = await locationRepository.findCountryById(ref.country_id);
    if (country) {
      full.country = {
        id: country.id,
        name: country.name,
        code: country.code,
      };
    }
  }

  if (ref.state_id) {
    const state = await locationRepository.findStateById(ref.state_id);
    if (state) {
      full.state = {
        id: state.id,
        name: state.name,
        code: state.code,
      };
    }
  }

  if (ref.city_id) {
    const city = await locationRepository.findCityById(ref.city_id);
    if (city) {
      full.city = {
        id: city.id,
        name: city.name,
      };
    }
  }

  if (ref.neighborhood_id) {
    const neighborhood = await locationRepository.findNeighborhoodById(ref.neighborhood_id);
    if (neighborhood) {
      full.neighborhood = {
        id: neighborhood.id,
        name: neighborhood.name,
      };
    }
  }

  full.postalCode = ref.postal_code;
  full.street = ref.street;
  full.number = ref.number;
  full.complement = ref.complement;

  return full;
}

// Função normalizeName removida - não mais necessária sem name_normalized

