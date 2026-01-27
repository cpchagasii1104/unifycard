// src/core/location/address.types.ts
// Location Core - Contrato único de endereço

import type { LocationRef } from './location.types';

/**
 * Contrato único de endereço (AddressRef)
 * Usado por todos os módulos: User, Company, Group, Event, School, Voting, etc.
 * 
 * PRINCÍPIOS:
 * - CEP é UX, não é fonte de verdade
 * - Fonte de verdade é o Location Core (IDs normalizados)
 * - Banco armazena dados NORMALIZADOS
 * - UI exibe dados FORMATADOS (com acento, nomes corretos)
 */
export interface AddressRef extends LocationRef {
  /**
   * ID do endereço (se já existe na tabela addresses)
   */
  address_id?: string;

  /**
   * CEP/Postal Code (opcional)
   * Usado apenas para enriquecimento, não é armazenado como localização
   */
  postal_code?: string;

  /**
   * Logradouro/Rua (texto livre, não normalizado)
   */
  street?: string;

  /**
   * Número (texto livre)
   */
  number?: string;

  /**
   * Complemento (texto livre)
   */
  complement?: string;

  /**
   * Coordenadas geográficas (opcional)
   */
  latitude?: number;
  longitude?: number;
}

/**
 * Endereço completo com nomes formatados (para exibição)
 */
export interface FullAddress {
  country?: {
    id: string;
    name: string;
    code: string;
  };
  state?: {
    id: string;
    name: string;
    code: string;
  };
  city?: {
    id: string;
    name: string;
  };
  neighborhood?: {
    id: string;
    name: string;
  };
  postalCode?: string;
  street?: string;
  number?: string;
  complement?: string;
}

/**
 * Helper para converter AddressRef em string formatada
 */
export function formatAddress(address: FullAddress): string {
  const parts: string[] = [];

  if (address.street) {
    parts.push(address.street);
    if (address.number) {
      parts.push(address.number);
    }
  }

  if (address.neighborhood) {
    parts.push(address.neighborhood.name);
  }

  if (address.city) {
    parts.push(address.city.name);
  }

  if (address.state) {
    parts.push(address.state.code);
  }

  if (address.postalCode) {
    parts.push(address.postalCode);
  }

  return parts.join(', ');
}

