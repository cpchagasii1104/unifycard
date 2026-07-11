// src/core/location/location-enrichment.service.ts
// Location Core - Serviço de enriquecimento via CEP

import { pool } from '@core/database/pool';
import { locationRepository } from './location.repository';
import type { LocationRef } from './location.types';

// Importar CEPService de forma dinâmica para evitar dependência circular
let cepService: any = null;
async function getCEPService() {
  if (!cepService) {
    const module = await import('../../services/location/cep.service');
    cepService = module.cepService;
  }
  return cepService;
}

/**
 * Dados retornados pela API de CEP
 */
export interface CEPEnrichmentData {
  cep: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade: string; // Cidade
  uf: string; // Estado (sigla)
  erro?: boolean;
}

/**
 * Resultado do enriquecimento
 */
export interface EnrichmentResult {
  addressRef: {
    country_id: string;
    state_id: string;
    city_id: string;
    neighborhood_id?: string;
    postal_code?: string;
    street?: string;
    complement?: string;
  };
  labels: {
    country: string;
    state: string;
    city: string;
    neighborhood?: string;
  };
  created: {
    country: boolean;
    state: boolean;
    city: boolean;
    neighborhood: boolean;
  };
  addressId?: string; // ID do endereço criado na tabela addresses (se solicitado)
}

/**
 * Função auxiliar para normalizar nome (mesma lógica do banco)
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .trim();
}

class LocationEnrichmentService {
  /**
   * Enriquecer localização a partir de CEP
   * - Consulta API externa (CEP)
   * - Normaliza e busca/cria registros no Location Core
   * - Retorna AddressRef pronto para uso
   */
  async enrichFromCEP(cep: string): Promise<EnrichmentResult | null> {
    // Buscar CEP na API externa
    const cepServiceInstance = await getCEPService();
    const cepData = await cepServiceInstance.fetchCEP(cep);
    if (!cepData || cepData.erro) {
      return null;
    }

    // Assumir Brasil (CEP é apenas do Brasil)
    const countryCode = 'BR';
    
    // Buscar ou criar país
    let country = await locationRepository.findCountryByCode(countryCode);
    if (!country) {
      const created = await this.createCountry({
        code: countryCode,
        name: 'Brasil',
      });
      country = { id: created.id, code: created.code, name: created.name, isActive: true };
    }

    // Buscar ou criar estado
    // Primeiro buscar nome completo do estado pela sigla (se possível)
    const stateNameForCreation = await this.getStateNameByCode(cepData.uf) || cepData.uf;
    const stateNormalized = normalizeName(stateNameForCreation);
    let state = await this.findOrCreateState(
      country.id,
      cepData.uf,
      stateNameForCreation,
      stateNormalized
    );

    // Buscar ou criar cidade
    const cityNormalized = normalizeName(cepData.localidade);
    let city = await this.findOrCreateCity(
      state.id,
      cepData.localidade,
      cityNormalized
    );

    // ── CONTENÇÃO N0 · DT-LOCATION-CORE-NEIGHBORHOOD-FREE-TEXT-WRITER ──────────────────
    // DECISION-0079 §6 (bairro NUNCA vira FK por texto livre) + DECISION-0166 D4 (nível
    // neighborhood em HOLD até existir catálogo governado). Este serviço legado criava
    // `neighborhood_id` por igualdade de nome normalizado — o exato anti-padrão vetado, que
    // materializaria bairros falsos/duplicados ("Centro" vs "centro" vs "Bairro Centro").
    // Fail-closed: o bairro do CEP segue APENAS como rótulo de exibição; `neighborhood_id`
    // permanece RESERVADO para a futura fundação canônica (F-NEIGHBORHOOD-CANONICAL-IDENTITY).
    // País/estado/cidade continuam sendo enriquecidos normalmente (preservados).
    const neighborhoodId: string | undefined = undefined;
    const neighborhoodDisplay = cepData.bairro?.trim() || undefined;

    // Buscar nomes formatados para exibição
    const countryName = country.name;
    const stateName = state.name;
    const cityName = city.name;
    const neighborhoodName = neighborhoodDisplay; // só exibição — nunca FK (contenção N0)

    return {
      addressRef: {
        country_id: country.id,
        state_id: state.id,
        city_id: city.id,
        neighborhood_id: neighborhoodId,
        postal_code: cepData.cep,
        street: cepData.logradouro || undefined,
        complement: cepData.complemento || undefined,
      },
      labels: {
        country: countryName,
        state: stateName,
        city: cityName,
        neighborhood: neighborhoodName,
      },
      created: {
        country: false, // Brasil já existe
        state: state.created,
        city: city.created,
        neighborhood: !!neighborhoodId,
      },
    };
  }

  /**
   * Buscar ou criar país
   */
  private async createCountry(input: { code: string; name: string }): Promise<{ id: string; code: string; name: string }> {
    const result = await pool.query<{ country_id: string; code: string; name: string }>(
      `
      INSERT INTO countries (code, name)
      VALUES ($1, $2)
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
      RETURNING country_id as id, code, name
      `,
      [input.code, input.name]
    );
    const row = result.rows[0] as any;
    return { id: row.id, code: row.code, name: row.name };
  }

  /**
   * Buscar ou criar estado
   */
  private async findOrCreateState(
    countryId: string,
    code: string,
    nameDisplay: string,
    nameNormalized: string
  ): Promise<{ id: string; code: string; name: string; created: boolean }> {
    // Primeiro tentar buscar por código
    let state = await locationRepository.findStateByCode(countryId, code);
    if (state) {
      return { id: state.id, code: state.code, name: state.name, created: false };
    }

    // Tentar buscar por nome (case-insensitive)
    const result = await pool.query<{ state_id: string; code: string; name: string }>(
      `
      SELECT state_id as id, code, name
      FROM states
      WHERE country_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))
      LIMIT 1
      `,
      [countryId, nameDisplay]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0] as any;
      return { id: row.id, code: row.code, name: row.name, created: false };
    }

    // Criar novo estado
    const createResult = await pool.query<{ state_id: string; code: string; name: string }>(
      `
      INSERT INTO states (country_id, code, name)
      VALUES ($1, $2, $3)
      ON CONFLICT (country_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING state_id as id, code, name
      `,
      [countryId, code, nameDisplay]
    );

    const createRow = createResult.rows[0] as any;
    return { id: createRow.id, code: createRow.code, name: createRow.name, created: true };
  }

  /**
   * Buscar ou criar cidade
   */
  private async findOrCreateCity(
    stateId: string,
    nameDisplay: string,
    nameNormalized: string
  ): Promise<{ id: string; name: string; created: boolean }> {
    // Tentar buscar por nome (case-insensitive)
    const result = await pool.query<{ city_id: string; name: string }>(
      `
      SELECT city_id as id, name
      FROM cities
      WHERE state_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))
      LIMIT 1
      `,
      [stateId, nameDisplay]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0] as any;
      return { id: row.id, name: row.name, created: false };
    }

    // Criar nova cidade
    const createResult = await pool.query<{ city_id: string; name: string }>(
      `
      INSERT INTO cities (state_id, name)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      RETURNING city_id as id, name
      `,
      [stateId, nameDisplay]
    );

    if (createResult.rows.length > 0) {
      const createRow = createResult.rows[0] as any;
      return { id: createRow.id, name: createRow.name, created: true };
    }

    // Se ON CONFLICT não retornou, buscar novamente
    const retryResult = await pool.query<{ city_id: string; name: string }>(
      `
      SELECT city_id as id, name
      FROM cities
      WHERE state_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2))
      LIMIT 1
      `,
      [stateId, nameDisplay]
    );

    if (retryResult.rows.length > 0) {
      const retryRow = retryResult.rows[0] as any;
      return { id: retryRow.id, name: retryRow.name, created: false };
    }

    throw new Error('Erro ao criar cidade');
  }

  /**
   * GUARD DE CONTENÇÃO (N0) — DT-LOCATION-CORE-NEIGHBORHOOD-FREE-TEXT-WRITER.
   *
   * Este método CRIAVA bairro por igualdade de nome normalizado (`INSERT INTO neighborhoods`),
   * violando DECISION-0079 §6 (proibido bairro FK por texto livre) e DECISION-0166 D4 (nível
   * neighborhood em HOLD até existir catálogo governado). Foi NEUTRALIZADO: não contém mais
   * nenhum SQL de escrita. Permanece como tripwire fail-closed — qualquer tentativa futura de
   * reviver o writer legado falha em alto e bom som, em vez de materializar um `neighborhood_id`
   * falso. A criação canônica de bairro só pode nascer na fundação governada
   * F-NEIGHBORHOOD-CANONICAL-IDENTITY (catálogo com fonte/curadoria/aprovação), NUNCA aqui a
   * partir de texto de CEP/provider/usuário.
   */
  private async findOrCreateNeighborhood(
    _cityId: string,
    _nameDisplay: string,
    _nameNormalized: string
  ): Promise<never> {
    throw new Error(
      'NEIGHBORHOOD_CANONICAL_IDENTITY_HOLD: criação de bairro por texto livre está contida ' +
        '(DECISION-0079 §6 / DECISION-0166 D4). Use a fundação governada ' +
        'F-NEIGHBORHOOD-CANONICAL-IDENTITY; este writer legado foi desativado.'
    );
  }

  /**
   * Buscar nome completo do estado pela sigla (helper)
   */
  private async getStateNameByCode(code: string): Promise<string | null> {
    // Mapeamento básico de siglas para nomes (pode ser expandido)
    const stateNames: Record<string, string> = {
      AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas',
      BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo',
      GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
      MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
      PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
      RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina',
      SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
    };

    return stateNames[code.toUpperCase()] || null;
  }
}

export const locationEnrichmentService = new LocationEnrichmentService();

