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
        country_id, state_id, city_id, neighborhood_id,
        postal_code, street, number, complement, reference,
        source, lat, lng, is_geocoded, created_by_tenant_id
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8, $9,
        $10, $11, $12,
        CASE WHEN $11::numeric IS NOT NULL THEN true ELSE false END,
        $13
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
}

export const locationRepository = new LocationRepository();
