// src/core/world/repositories/city.repository.ts
import { runSystemQuery } from '@core/db';
import type { CityRow } from '../world.types';

export class CityRepository {
  /**
   * Busca todas as cidades de um estado
   */
  async findByStateId(stateId: string): Promise<CityRow[]> {
    return runSystemQuery<CityRow>({
      text: `
        SELECT 
          city_id,
          state_id,
          name,
          name_en,
          latitude,
          longitude,
          created_at,
          updated_at
        FROM cities
        WHERE state_id = $1
        ORDER BY name ASC
      `,
      values: [stateId],
    });
  }

  /**
   * Busca cidade por ID
   */
  async findById(cityId: string): Promise<CityRow | undefined> {
    const rows = await runSystemQuery<CityRow>({
      text: `
        SELECT 
          city_id,
          state_id,
          name,
          name_en,
          latitude,
          longitude,
          created_at,
          updated_at
        FROM cities
        WHERE city_id = $1
      `,
      values: [cityId],
    });
    return rows[0];
  }

  /**
   * Busca cidades por termo (busca em nome e nome em inglês)
   */
  async search(term: string, countryId?: string, stateId?: string, limit: number = 20, offset: number = 0): Promise<CityRow[]> {
    const searchTerm = `%${term}%`;
    let query = `
      SELECT 
        c.city_id,
        c.state_id,
        c.name,
        c.name_en,
        c.latitude,
        c.longitude,
        c.created_at,
        c.updated_at
      FROM cities c
      INNER JOIN states s ON c.state_id = s.state_id
      WHERE (
        UPPER(c.name) LIKE UPPER($1)
        OR UPPER(c.name_en) LIKE UPPER($1)
      )
    `;
    const values: any[] = [searchTerm];
    let paramIndex = 2;

    if (stateId) {
      query += ` AND c.state_id = $${paramIndex}`;
      values.push(stateId);
      paramIndex++;
    } else if (countryId) {
      query += ` AND s.country_id = $${paramIndex}`;
      values.push(countryId);
      paramIndex++;
    }

    query += ` ORDER BY c.name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);

    return runSystemQuery<CityRow>({
      text: query,
      values,
    });
  }
}








