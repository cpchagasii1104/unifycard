// src/core/location/address-helpers.ts
// Location Core - Helpers para adaptação gradual de módulos existentes

import { locationRepository } from './location.repository';
import type { AddressRef, FullAddress } from './address.types';

// FASE B (RFC B1-D · D-K): o helper morto `convertLegacyAddressToRef` — que resolvia city por
// igualdade de nome (LOWER(TRIM(name))), o exato anti-padrão vetado pela decisão — foi REMOVIDO
// (zero callers). Identidade de cidade é código oficial escopado pela jurisdição; texto de
// cidade nunca resolve identidade. `getFullAddress` (read-only por ID) permanece.

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

