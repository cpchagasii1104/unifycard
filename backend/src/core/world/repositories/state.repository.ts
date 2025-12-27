// src/core/world/repositories/state.repository.ts
import { runSystemQuery } from '@core/db';
import type { StateRow } from '../world.types';

export class StateRepository {
  /**
   * Busca todos os estados de um país
   */
  async findByCountryId(countryId: string): Promise<StateRow[]> {
    return runSystemQuery<StateRow>({
      text: `
        SELECT 
          state_id,
          country_id,
          code,
          name,
          name_en,
          created_at,
          updated_at
        FROM states
        WHERE country_id = $1
        ORDER BY name ASC
      `,
      values: [countryId],
    });
  }

  /**
   * Busca estado por ID
   */
  async findById(stateId: string): Promise<StateRow | undefined> {
    const rows = await runSystemQuery<StateRow>({
      text: `
        SELECT 
          state_id,
          country_id,
          code,
          name,
          name_en,
          created_at,
          updated_at
        FROM states
        WHERE state_id = $1
      `,
      values: [stateId],
    });
    return rows[0];
  }
}








