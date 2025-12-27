// src/core/root-config/root-config.model.ts
import type { RootConfig, RootConfigRow } from './root-config.types';

export class RootConfigModel {
  /**
   * Converte row do banco para objeto RootConfig
   */
  static fromRow(row: RootConfigRow): RootConfig {
    return {
      id: row.id,
      countryId: row.country_id,
      stateId: row.state_id,
      cityId: row.city_id,
      timezone: row.timezone,
      currency: row.currency,
      languages: row.languages || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}








