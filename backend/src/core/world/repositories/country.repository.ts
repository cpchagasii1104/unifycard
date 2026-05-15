// src/core/world/repositories/country.repository.ts
import { runSystemQuery } from '@core/db';
import type { CountryRow } from '../world.types';

type CountryRowDb = Omit<CountryRow, 'createdAt' | 'updatedAt'> & {
  created_at: string;
  updated_at: string;
};

export class CountryRepository {
  /**
   * Busca todos os países
   */
  async findAll(): Promise<CountryRow[]> {
    const rows = await runSystemQuery<CountryRowDb>({
      text: `
        SELECT
          country_id,
          iso_alpha2 AS code,
          name,
          NULL::text AS name_en,
          created_at,
          updated_at
        FROM countries
        ORDER BY name ASC
      `,
    });

    return rows.map((r) => ({
      ...r,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Busca país por ID
   */
  async findById(countryId: string): Promise<CountryRow | undefined> {
    const rows = await runSystemQuery<CountryRowDb>({
      text: `
        SELECT
          country_id,
          iso_alpha2 AS code,
          name,
          NULL::text AS name_en,
          created_at,
          updated_at
        FROM countries
        WHERE country_id = $1
      `,
      values: [countryId],
    });
    const r = rows[0];
    if (!r) return undefined;
    return {
      ...r,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  /**
   * Busca país por código ISO
   */
  async findByCode(code: string): Promise<CountryRow | undefined> {
    const rows = await runSystemQuery<CountryRowDb>({
      text: `
        SELECT
          country_id,
          iso_alpha2 AS code,
          name,
          NULL::text AS name_en,
          created_at,
          updated_at
        FROM countries
        WHERE UPPER(iso_alpha2) = UPPER($1)
      `,
      values: [code],
    });
    const r = rows[0];
    if (!r) return undefined;
    return {
      ...r,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}

















