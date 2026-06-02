// src/core/location/location.repository.ts
// Location Core - Repository (acesso ao banco de dados)

import { pool } from '@core/database/pool';
import type {
  Country,
  State,
  City,
  Neighborhood,
  CountryRow,
  StateRow,
  CityRow,
  NeighborhoodRow,
  CreateAddressInput,
  Address,
  AddressOwnerType,
  AddressRole,
  AddressAssignment,
  CachedCepResolution,
  PrimaryResidenceGeo,
} from './location.types';

class LocationRepository {
  /**
   * Buscar todos os países ativos
   */
  async findAllCountries(): Promise<Country[]> {
    const result = await pool.query<CountryRow>(
      `
      SELECT country_id as id, iso_alpha2 AS code, name, is_active
      FROM countries
      WHERE is_active = true
      ORDER BY name ASC
      `
    );

    return result.rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      isActive: row.is_active,
    }));
  }

  /**
   * Buscar país por ID
   */
  async findCountryById(countryId: string): Promise<Country | null> {
    const result = await pool.query<CountryRow>(
      `
      SELECT country_id as id, iso_alpha2 AS code, name, is_active
      FROM countries
      WHERE country_id = $1
      `,
      [countryId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as any;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      isActive: row.is_active,
    };
  }

  /**
   * Buscar estados de um país
   */
  async findStatesByCountry(countryId: string): Promise<State[]> {
    const result = await pool.query<StateRow>(
      `
      SELECT s.state_id as id, s.country_id as countryId, s.abbreviation AS code, s.name
      FROM states s
      WHERE s.country_id = $1
      ORDER BY s.name ASC
      `,
      [countryId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      countryId: row.countryId,
      code: row.code,
      name: row.name,
    }));
  }

  /**
   * Buscar estado por ID
   */
  async findStateById(stateId: string): Promise<State | null> {
    const result = await pool.query<StateRow>(
      `
      SELECT s.state_id as id, s.country_id as countryId, s.abbreviation AS code, s.name
      FROM states s
      WHERE s.state_id = $1
      `,
      [stateId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as any;
    return {
      id: row.id,
      countryId: row.countryId,
      code: row.code,
      name: row.name,
    };
  }

  /**
   * Buscar cidades de um estado
   */
  async findCitiesByState(stateId: string): Promise<City[]> {
    const result = await pool.query<CityRow>(
      `
      SELECT c.city_id as id, c.state_id as stateId, c.name
      FROM cities c
      WHERE c.state_id = $1
      ORDER BY c.name ASC
      `,
      [stateId]
    );

    return result.rows.map((row) => ({
      id: row.city_id,
      stateId: row.state_id,
      name: row.name,
    }));
  }

  /**
   * Buscar cidade por ID
   */
  async findCityById(cityId: string): Promise<City | null> {
    const result = await pool.query<CityRow>(
      `
      SELECT c.city_id as id, c.state_id as stateId, c.name
      FROM cities c
      WHERE c.city_id = $1
      `,
      [cityId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as any;
    return {
      id: row.id,
      stateId: row.stateId,
      name: row.name,
    };
  }

  /**
   * Buscar bairros de uma cidade
   */
  async findNeighborhoodsByCity(cityId: string): Promise<Neighborhood[]> {
    const result = await pool.query<NeighborhoodRow>(
      `
      SELECT n.neighborhood_id as id, n.city_id as cityId, n.name
      FROM neighborhoods n
      WHERE n.city_id = $1
      ORDER BY n.name ASC
      `,
      [cityId]
    );

    return result.rows.map((row) => ({
      id: row.neighborhood_id,
      cityId: row.city_id,
      name: row.name,
    }));
  }

  /**
   * Buscar bairro por ID
   */
  async findNeighborhoodById(neighborhoodId: string): Promise<Neighborhood | null> {
    const result = await pool.query<NeighborhoodRow>(
      `
      SELECT n.neighborhood_id as id, n.city_id as cityId, n.name
      FROM neighborhoods n
      WHERE n.neighborhood_id = $1
      `,
      [neighborhoodId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as any;
    return {
      id: row.id,
      cityId: row.cityId,
      name: row.name,
    };
  }

  /**
   * Verificar se estado pertence ao país
   */
  async validateStateBelongsToCountry(stateId: string, countryId: string): Promise<boolean> {
    const result = await pool.query<{ exists: boolean }>(
      `
      SELECT EXISTS(
        SELECT 1 FROM states
        WHERE state_id = $1 AND country_id = $2
      ) as exists
      `,
      [stateId, countryId]
    );

    return result.rows[0]?.exists ?? false;
  }

  /**
   * Verificar se cidade pertence ao estado
   */
  async validateCityBelongsToState(cityId: string, stateId: string): Promise<boolean> {
    const result = await pool.query<{ exists: boolean }>(
      `
      SELECT EXISTS(
        SELECT 1 FROM cities
        WHERE city_id = $1 AND state_id = $2
      ) as exists
      `,
      [cityId, stateId]
    );

    return result.rows[0]?.exists ?? false;
  }

  /**
   * Verificar se bairro pertence à cidade
   */
  async validateNeighborhoodBelongsToCity(neighborhoodId: string, cityId: string): Promise<boolean> {
    const result = await pool.query<{ exists: boolean }>(
      `
      SELECT EXISTS(
        SELECT 1 FROM neighborhoods
        WHERE neighborhood_id = $1 AND city_id = $2
      ) as exists
      `,
      [neighborhoodId, cityId]
    );

    return result.rows[0]?.exists ?? false;
  }

  /**
   * Buscar país por código ISO
   */
  async findCountryByCode(code: string): Promise<Country | null> {
    const result = await pool.query<CountryRow>(
      `
      SELECT country_id as id, iso_alpha2 AS code, name, is_active
      FROM countries
      WHERE iso_alpha2 = $1
      `,
      [code.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as any;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      isActive: row.is_active,
    };
  }

  /**
   * Buscar estado por código e país
   */
  async findStateByCode(countryId: string, code: string): Promise<State | null> {
    const result = await pool.query<StateRow>(
      `
      SELECT s.state_id as id, s.country_id as countryId, s.abbreviation AS code, s.name
      FROM states s
      WHERE s.country_id = $1 AND s.abbreviation = $2
      `,
      [countryId, code.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as any;
    return {
      id: row.id,
      countryId: row.countryId,
      code: row.code,
      name: row.name,
    };
  }

  async createAddress(
    data: CreateAddressInput,
    createdByTenantId: string | null
  ): Promise<Address> {
    const result = await pool.query<Address>(
      `
      INSERT INTO addresses (
        country_id, state_id, city_id, neighborhood_id, neighborhood_display_text,
        postal_code, street, number, complement, reference,
        source, lat, lng, is_geocoded, created_by_tenant_id
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13,
        CASE WHEN $12::numeric IS NOT NULL THEN true ELSE false END,
        $14
      )
      RETURNING
        address_id AS id,
        country_id AS "countryId",
        state_id AS "stateId",
        city_id AS "cityId",
        neighborhood_id AS "neighborhoodId",
        postal_code AS "postalCode",
        street, number, complement, reference,
        source,
        is_geocoded AS "isGeocoded",
        lat, lng,
        created_by_tenant_id AS "createdByTenantId",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      `,
      [
        data.countryId,
        data.stateId ?? null,
        data.cityId ?? null,
        data.neighborhoodId ?? null,
        // F-GEO-4a (DECISION-0079): bairro de exibição controlado (não FK). Default null — nenhum caller
        // passa valor nesta fatia; o destino fica pronto para o F-GEO-4b migrar o bairro do blob.
        data.neighborhoodDisplayText ?? null,
        data.postalCode ?? null,
        data.street ?? null,
        data.number ?? null,
        data.complement ?? null,
        data.reference ?? null,
        data.source,
        data.lat ?? null,
        data.lng ?? null,
        createdByTenantId,
      ]
    );

    return result.rows[0] as Address;
  }

  async assignAddress(
    addressId: string,
    ownerType: AddressOwnerType,
    ownerId: string,
    role: AddressRole,
    isPrimary: boolean = false
  ): Promise<AddressAssignment> {
    const result = await pool.query<AddressAssignment>(
      `
      INSERT INTO address_assignments (
        owner_type, owner_id, address_id, role, is_primary
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING
        assignment_id AS id,
        owner_type AS "ownerType",
        owner_id AS "ownerId",
        address_id AS "addressId",
        role,
        is_primary AS "isPrimary",
        valid_from_at AS "validFromAt",
        valid_until_at AS "validUntilAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      `,
      [ownerType, ownerId, addressId, role, isPrimary]
    );

    return result.rows[0] as AddressAssignment;
  }

  /**
   * Cria address + assignment em UMA transação SQL atômica.
   *
   * Garante que se o INSERT do assignment falhar (FK / CHECK / UNIQUE),
   * o INSERT do address é ROLLBACK — sem rastros órfãos em `addresses`.
   *
   * Fecha DT-PE5-CARTORIO-ATOMICITY (PE-5-CARTÓRIO-HARDENING 2026-05-26).
   *
   * Caller-side: usar quando endereço NUNCA existe sem assignment associado
   * (cartório operacional). Para fluxos onde endereço pode pré-existir e
   * só o assignment muda, continuar usando `createAddress` + `assignAddress`
   * separados.
   */
  async createAddressAndAssign(
    addressInput: CreateAddressInput,
    createdByTenantId: string | null,
    assignment: {
      ownerType: AddressOwnerType;
      ownerId: string;
      role: AddressRole;
      isPrimary?: boolean;
    }
  ): Promise<{ address: Address; assignment: AddressAssignment }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const addressResult = await client.query<Address>(
        `
        INSERT INTO addresses (
          country_id, state_id, city_id, neighborhood_id, neighborhood_display_text,
          postal_code, street, number, complement, reference,
          source, lat, lng, is_geocoded, created_by_tenant_id
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13,
          CASE WHEN $12::numeric IS NOT NULL THEN true ELSE false END,
          $14
        )
        RETURNING
          address_id AS id,
          country_id AS "countryId",
          state_id AS "stateId",
          city_id AS "cityId",
          neighborhood_id AS "neighborhoodId",
          postal_code AS "postalCode",
          street, number, complement, reference,
          source,
          is_geocoded AS "isGeocoded",
          lat, lng,
          created_by_tenant_id AS "createdByTenantId",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        `,
        [
          addressInput.countryId,
          addressInput.stateId ?? null,
          addressInput.cityId ?? null,
          addressInput.neighborhoodId ?? null,
          // F-GEO-4a (DECISION-0079): bairro de exibição controlado (não FK). Default null nesta fatia.
          addressInput.neighborhoodDisplayText ?? null,
          addressInput.postalCode ?? null,
          addressInput.street ?? null,
          addressInput.number ?? null,
          addressInput.complement ?? null,
          addressInput.reference ?? null,
          addressInput.source,
          addressInput.lat ?? null,
          addressInput.lng ?? null,
          createdByTenantId,
        ]
      );
      const createdAddress = addressResult.rows[0] as Address;

      const assignmentResult = await client.query<AddressAssignment>(
        `
        INSERT INTO address_assignments (
          owner_type, owner_id, address_id, role, is_primary
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING
          assignment_id AS id,
          owner_type AS "ownerType",
          owner_id AS "ownerId",
          address_id AS "addressId",
          role,
          is_primary AS "isPrimary",
          valid_from_at AS "validFromAt",
          valid_until_at AS "validUntilAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        `,
        [
          assignment.ownerType,
          assignment.ownerId,
          createdAddress.id,
          assignment.role,
          assignment.isPrimary ?? false,
        ]
      );
      const createdAssignment = assignmentResult.rows[0] as AddressAssignment;

      await client.query('COMMIT');
      return { address: createdAddress, assignment: createdAssignment };
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ROLLBACK falhou (conexão perdida) — propaga erro original.
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * F1 (DECISION-0074): endereço primário vigente de um owner por role.
   * Lê `address_assignments` (is_primary=true, valid_until_at IS NULL) → JOIN `addresses`.
   * Usado pela residência civil PF (owner_type='profile', role='RESIDENCE').
   */
  async findPrimaryAddressByOwner(
    ownerType: AddressOwnerType,
    ownerId: string,
    role: AddressRole
  ): Promise<Address | null> {
    const result = await pool.query<Address>(
      `
      SELECT
        a.address_id AS id,
        a.country_id AS "countryId",
        a.state_id AS "stateId",
        a.city_id AS "cityId",
        a.neighborhood_id AS "neighborhoodId",
        a.postal_code AS "postalCode",
        a.street, a.number, a.complement, a.reference,
        a.source,
        a.is_geocoded AS "isGeocoded",
        a.lat, a.lng,
        a.created_by_tenant_id AS "createdByTenantId",
        a.created_at AS "createdAt",
        a.updated_at AS "updatedAt"
      FROM address_assignments aa
      JOIN addresses a ON a.address_id = aa.address_id
      WHERE aa.owner_type = $1
        AND aa.owner_id = $2
        AND aa.role = $3
        AND aa.is_primary = TRUE
        AND aa.valid_until_at IS NULL
      ORDER BY aa.valid_from_at DESC
      LIMIT 1
      `,
      [ownerType, ownerId, role]
    );
    return result.rows[0] ?? null;
  }

  /**
   * F-GEO-3 (DECISION-0074/0077): residência primária vigente do owner COM city/state resolvidos
   * por FK canônica (LEFT JOIN states/cities). Colunas explícitas (sem SELECT *). F-GEO-4a: passa a
   * incluir `neighborhood_display_text` (bairro de exibição controlado, NÃO FK). Usado pelo core.service
   * para exibir cidade/UF canônicas sem depender do blob.
   */
  async findPrimaryResidenceGeoByOwner(
    ownerType: AddressOwnerType,
    ownerId: string,
    role: AddressRole
  ): Promise<PrimaryResidenceGeo | null> {
    const result = await pool.query<PrimaryResidenceGeo>(
      `
      SELECT
        a.address_id AS "addressId",
        a.postal_code AS "postalCode",
        a.street, a.number, a.complement,
        s.abbreviation AS "stateAbbreviation",
        s.name AS "stateName",
        c.name AS "cityName",
        c.external_code AS "cityExternalCode",
        a.neighborhood_display_text AS "neighborhoodDisplayText"
      FROM address_assignments aa
      JOIN addresses a ON a.address_id = aa.address_id
      LEFT JOIN states s ON s.state_id = a.state_id
      LEFT JOIN cities c ON c.city_id = a.city_id
      WHERE aa.owner_type = $1
        AND aa.owner_id = $2
        AND aa.role = $3
        AND aa.is_primary = TRUE
        AND aa.valid_until_at IS NULL
      ORDER BY aa.valid_from_at DESC
      LIMIT 1
      `,
      [ownerType, ownerId, role]
    );
    return result.rows[0] ?? null;
  }

  /**
   * F-GEO-4b (DECISION-0079): grava o bairro de exibição controlado (`neighborhood_display_text`) em um
   * `addresses`. Texto livre de exibição (NÃO FK, NÃO SSOT territorial). Retorna a linha atualizada.
   * A decisão de sobrescrever/preservar (idempotência, conflito) é do caller (script de backfill).
   */
  async updateAddressNeighborhoodDisplayText(
    addressId: string,
    neighborhoodDisplayText: string | null
  ): Promise<number> {
    const result = await pool.query(
      `
      UPDATE addresses
      SET neighborhood_display_text = $2, updated_at = now()
      WHERE address_id = $1
      `,
      [addressId, neighborhoodDisplayText]
    );
    return result.rowCount ?? 0;
  }

  /**
   * F1 (DECISION-0074): aposenta (soft) o assignment primário vigente de um owner/role,
   * fechando `valid_until_at` e zerando `is_primary` — respeita o UNIQUE parcial (1 primary por
   * owner/role vigente) antes de inserir um novo. NUNCA DELETE (preserva histórico temporal).
   */
  async retirePrimaryAssignment(
    ownerType: AddressOwnerType,
    ownerId: string,
    role: AddressRole
  ): Promise<number> {
    const result = await pool.query(
      `
      UPDATE address_assignments
      SET valid_until_at = now(), is_primary = FALSE, updated_at = now()
      WHERE owner_type = $1
        AND owner_id = $2
        AND role = $3
        AND is_primary = TRUE
        AND valid_until_at IS NULL
      `,
      [ownerType, ownerId, role]
    );
    return result.rowCount ?? 0;
  }

  /**
   * F-GEO-1a (DECISION-0077): busca cidade pelo `external_code` (IBGE). Reuso no import sob demanda.
   */
  async findCityByExternalCode(externalCode: string): Promise<City | null> {
    const result = await pool.query<{ city_id: string; state_id: string; name: string }>(
      `
      SELECT city_id, state_id, name
      FROM cities
      WHERE external_code = $1
      LIMIT 1
      `,
      [externalCode]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0]!;
    return { id: row.city_id, stateId: row.state_id, name: row.name };
  }

  /**
   * F-GEO-1a (DECISION-0077): cria cidade SOB DEMANDA a partir de dado externo (IBGE).
   * `name_normalized` é coluna GERADA — não inserir. `lat`/`lng` opcionais (centroide; NÃO coordenada
   * precisa de residência). Idempotência fica a cargo do chamador (findCityByExternalCode antes).
   */
  async createCityFromExternal(input: {
    stateId: string;
    name: string;
    externalCode: string;
    lat?: number | null;
    lng?: number | null;
  }): Promise<City> {
    const result = await pool.query<{ city_id: string; state_id: string; name: string }>(
      `
      INSERT INTO cities (state_id, name, external_code, lat, lng)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING city_id, state_id, name
      `,
      [input.stateId, input.name, input.externalCode, input.lat ?? null, input.lng ?? null]
    );
    const row = result.rows[0]!;
    return { id: row.city_id, stateId: row.state_id, name: row.name };
  }

  /**
   * F-GEO-1a (DECISION-0077): enriquece um `addresses` com FK de localização resolvida.
   * Atualiza apenas state_id/city_id/source (+ is_geocoded/geocoded_at se houver geo coarse). NÃO grava
   * lat/lng de residência (privacidade — geo coarse vem do centroide da cidade via FK). Colunas explícitas.
   */
  async updateAddressGeo(
    addressId: string,
    input: { stateId?: string | null; cityId?: string | null; source?: string }
  ): Promise<number> {
    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (input.stateId !== undefined) { fields.push(`state_id = $${i++}`); params.push(input.stateId); }
    if (input.cityId !== undefined) { fields.push(`city_id = $${i++}`); params.push(input.cityId); }
    if (input.source !== undefined) { fields.push(`source = $${i++}`); params.push(input.source); }
    if (fields.length === 0) return 0;
    params.push(addressId);
    const result = await pool.query(
      `UPDATE addresses SET ${fields.join(', ')}, updated_at = now() WHERE address_id = $${i}`,
      params
    );
    return result.rowCount ?? 0;
  }

  // ── F-GEO-1b (DECISION-0078): cache de resolução de CEP (insumo técnico, NÃO SSOT) ──────────────

  /** Busca uma resolução de CEP no cache (vigente: expires_at NULL ou futuro). null = miss. */
  async findCepResolutionByPostalCode(postalCode: string): Promise<CachedCepResolution | null> {
    const result = await pool.query<CachedCepResolution>(
      `
      SELECT
        postal_code AS "postalCode",
        provider,
        state_code AS "stateCode",
        city_name AS "cityName",
        city_external_code AS "cityExternalCode",
        neighborhood_name AS "neighborhoodName",
        street,
        source
      FROM cep_resolution_cache
      WHERE postal_code = $1
        AND (expires_at IS NULL OR expires_at > now())
      LIMIT 1
      `,
      [postalCode]
    );
    return result.rows[0] ?? null;
  }

  /** Insere/atualiza a resolução de CEP no cache. NÃO grava payload bruto nem lat/lng. */
  async upsertCepResolution(input: {
    postalCode: string;
    provider: string;
    stateCode?: string | null;
    cityName?: string | null;
    cityExternalCode?: string | null;
    neighborhoodName?: string | null;
    street?: string | null;
    source: string;
    rawResponseHash?: string | null;
    ttlDays?: number;
  }): Promise<void> {
    const ttl = input.ttlDays ?? 180;
    await pool.query(
      `
      INSERT INTO cep_resolution_cache (
        postal_code, provider, state_code, city_name, city_external_code,
        neighborhood_name, street, source, resolved_at, expires_at, raw_response_hash
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, now(), now() + ($9 || ' days')::interval, $10
      )
      ON CONFLICT (postal_code) DO UPDATE SET
        provider = EXCLUDED.provider,
        state_code = EXCLUDED.state_code,
        city_name = EXCLUDED.city_name,
        city_external_code = EXCLUDED.city_external_code,
        neighborhood_name = EXCLUDED.neighborhood_name,
        street = EXCLUDED.street,
        source = EXCLUDED.source,
        resolved_at = now(),
        expires_at = EXCLUDED.expires_at,
        raw_response_hash = EXCLUDED.raw_response_hash,
        updated_at = now()
      `,
      [
        input.postalCode,
        input.provider,
        input.stateCode ?? null,
        input.cityName ?? null,
        input.cityExternalCode ?? null,
        input.neighborhoodName ?? null,
        input.street ?? null,
        input.source,
        String(ttl),
        input.rawResponseHash ?? null,
      ]
    );
  }
}

export const locationRepository = new LocationRepository();
