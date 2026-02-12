// src/core/world/models/country.model.ts
import type { Country, CountryRow } from '../world.types';

export class CountryModel {
  /**
   * Converte row do banco para objeto Country
   */
  static fromRow(row: CountryRow): Country {
    return {
      countryId: row.country_id,
      code: row.code,
      name: row.name,
      nameEn: row.name_en,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Converte array de rows para array de Countries
   */
  static fromRows(rows: CountryRow[]): Country[] {
    return rows.map(row => this.fromRow(row));
  }
}

















