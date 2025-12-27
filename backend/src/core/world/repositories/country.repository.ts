// src/core/world/repositories/country.repository.ts
import { runSystemQuery } from '@core/db';
import type { CountryRow } from '../world.types';

export class CountryRepository {
  /**
   * Busca todos os países
   */
  async findAll(): Promise<CountryRow[]> {
    return runSystemQuery<CountryRow>({
      text: `
        SELECT 
          country_id,
          code,
          name,
          name_en,
          created_at,
          updated_at
        FROM countries
        ORDER BY name ASC
      `,
    });
  }

  /**
   * Busca país por ID
   */
  async findById(countryId: string): Promise<CountryRow | undefined> {
    const rows = await runSystemQuery<CountryRow>({
      text: `
        SELECT 
          country_id,
          code,
          name,
          name_en,
          created_at,
          updated_at
        FROM countries
        WHERE country_id = $1
      `,
      values: [countryId],
    });
    return rows[0];
  }

  /**
   * Busca país por código ISO
   */
  async findByCode(code: string): Promise<CountryRow | undefined> {
    const rows = await runSystemQuery<CountryRow>({
      text: `
        SELECT 
          country_id,
          code,
          name,
          name_en,
          created_at,
          updated_at
        FROM countries
        WHERE UPPER(code) = UPPER($1)
      `,
      values: [code],
    });
    return rows[0];
  }
}








