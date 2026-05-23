// src/core/residence/residence.service.ts
import { pool } from '@core/database/pool';
import { worldService } from '../world/services/world.service';
import { rootConfigService } from '../root-config/root-config.service';
import { resolveGlobalUserId } from '../identity/identity.utils';
import type {
  UserResidence,
  UserResidenceRow,
  SetResidenceInput,
  ResidenceResponse,
} from './residence.types';

class ResidenceService {
  private toUserResidence(row: UserResidenceRow): UserResidence {
    return {
      globalUserId: row.global_user_id,
      countryId: row.country_id,
      stateId: row.state_id,
      cityId: row.city_id,
      timezone: row.timezone,
      currency: row.currency,
      languages: row.languages || [],
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Busca residência digital de um usuário global
   */
  async getUserResidence(globalUserId: string): Promise<UserResidence | null> {
    const result = await pool.query<UserResidenceRow>(
      `
      SELECT global_user_id, country_id, state_id, city_id, timezone, currency, languages, created_at, updated_at
      FROM global_user_residence
      WHERE global_user_id = $1
      LIMIT 1
      `,
      [globalUserId]
    );

    if (!result.rows[0]) {
      return null;
    }

    return this.toUserResidence(result.rows[0]);
  }

  /**
   * Define ou atualiza residência digital de um usuário
   */
  async setUserResidence(
    globalUserId: string,
    input: SetResidenceInput
  ): Promise<UserResidence> {
    // Obter root-config como fallback
    const rootConfig = await rootConfigService.getConfig();

    // Determinar valores finais (input tem prioridade sobre root-config)
    let finalCountryId = input.countryId ?? rootConfig?.countryId ?? null;
    let finalStateId = input.stateId ?? rootConfig?.stateId ?? null;
    let finalCityId = input.cityId ?? rootConfig?.cityId ?? null;
    let finalTimezone = input.timezone ?? rootConfig?.timezone ?? null;
    let finalCurrency = input.currency ?? rootConfig?.currency ?? 'BRL';
    let finalLanguages = input.languages ?? rootConfig?.languages ?? [];

    // Se cityId foi fornecido, validar e obter stateId/countryId automaticamente
    if (finalCityId) {
      const cityPath = await worldService.getCityFullPath(finalCityId);
      if (!cityPath) {
        throw new Error('Cidade não encontrada');
      }
      finalStateId = cityPath.state.stateId;
      finalCountryId = cityPath.country.countryId;
    } else if (finalStateId) {
      // Se stateId foi fornecido, validar e obter countryId automaticamente
      const state = await worldService.getStateById(finalStateId);
      if (!state) {
        throw new Error('Estado não encontrado');
      }
      finalCountryId = state.countryId;
    } else if (finalCountryId) {
      // Validar se país existe
      const country = await worldService.getCountryById(finalCountryId);
      if (!country) {
        throw new Error('País não encontrado');
      }
    }

    // Validar hierarquia se todos os campos foram fornecidos
    if (finalStateId && finalCountryId) {
      const state = await worldService.getStateById(finalStateId);
      if (!state || state.countryId !== finalCountryId) {
        throw new Error('Estado não pertence ao país especificado');
      }
    }

    if (finalCityId && finalStateId) {
      const city = await worldService.getCityById(finalCityId);
      if (!city || city.stateId !== finalStateId) {
        throw new Error('Cidade não pertence ao estado especificado');
      }
    }

    // Upsert residência
    const result = await pool.query<UserResidenceRow>(
      `
      INSERT INTO global_user_residence (
        global_user_id,
        country_id,
        state_id,
        city_id,
        timezone,
        currency,
        languages
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (global_user_id)
      DO UPDATE SET
        country_id = EXCLUDED.country_id,
        state_id = EXCLUDED.state_id,
        city_id = EXCLUDED.city_id,
        timezone = COALESCE(EXCLUDED.timezone, global_user_residence.timezone),
        currency = COALESCE(EXCLUDED.currency, global_user_residence.currency),
        languages = COALESCE(EXCLUDED.languages, global_user_residence.languages),
        updated_at = now()
      RETURNING global_user_id, country_id, state_id, city_id, timezone, currency, languages, created_at, updated_at
      `,
      [
        globalUserId,
        finalCountryId,
        finalStateId,
        finalCityId,
        finalTimezone,
        finalCurrency,
        finalLanguages,
      ]
    );

    return this.toUserResidence(result.rows[0]);
  }

  /**
   * Define apenas preferências (timezone, currency, languages)
   */
  async setResidencePreferences(
    globalUserId: string,
    preferences: {
      timezone?: string | null;
      currency?: string;
      languages?: string[];
    }
  ): Promise<UserResidence> {
    // Buscar residência atual
    const current = await this.getUserResidence(globalUserId);

    if (!current) {
      // Se não existe, criar com root-config como base
      const rootConfig = await rootConfigService.getConfig();
      return this.setUserResidence(globalUserId, {
        countryId: rootConfig?.countryId ?? null,
        stateId: rootConfig?.stateId ?? null,
        cityId: rootConfig?.cityId ?? null,
        timezone: preferences.timezone ?? rootConfig?.timezone ?? null,
        currency: preferences.currency ?? rootConfig?.currency ?? 'BRL',
        languages: preferences.languages ?? rootConfig?.languages ?? [],
      });
    }

    // Atualizar apenas preferências
    return this.setUserResidence(globalUserId, {
      countryId: current.countryId,
      stateId: current.stateId,
      cityId: current.cityId,
      timezone: preferences.timezone ?? current.timezone,
      currency: preferences.currency ?? current.currency,
      languages: preferences.languages ?? current.languages,
    });
  }

  /**
   * Define automaticamente residência a partir do root-config
   * Usado quando usuário é criado e ainda não tem residência
   */
  async autoSetFromRootConfig(globalUserId: string): Promise<UserResidence> {
    const rootConfig = await rootConfigService.getConfig();

    return this.setUserResidence(globalUserId, {
      countryId: rootConfig?.countryId ?? null,
      stateId: rootConfig?.stateId ?? null,
      cityId: rootConfig?.cityId ?? null,
      timezone: rootConfig?.timezone ?? null,
      currency: rootConfig?.currency ?? 'BRL',
      languages: rootConfig?.languages ?? [],
    });
  }

  /**
   * Busca residência com dados completos (incluindo nomes de país/estado/cidade)
   */
  async getResidenceWithDetails(globalUserId: string): Promise<ResidenceResponse | null> {
    const residence = await this.getUserResidence(globalUserId);

    if (!residence) {
      return null;
    }

    let country = null;
    let state = null;
    let city = null;

    if (residence.cityId) {
      const cityPath = await worldService.getCityFullPath(residence.cityId);
      if (cityPath) {
        country = {
          countryId: cityPath.country.countryId,
          name: cityPath.country.name,
          code: cityPath.country.code,
        };
        state = {
          stateId: cityPath.state.stateId,
          name: cityPath.state.name,
          code: cityPath.state.code,
        };
        city = {
          cityId: cityPath.city.cityId,
          name: cityPath.city.name,
        };
      }
    } else if (residence.stateId) {
      const stateData = await worldService.getStateById(residence.stateId);
      if (stateData) {
        const countryData = await worldService.getCountryById(stateData.countryId);
        if (countryData) {
          country = {
            countryId: countryData.countryId,
            name: countryData.name,
            code: countryData.code,
          };
          state = {
            stateId: stateData.stateId,
            name: stateData.name,
            code: stateData.code,
          };
        }
      }
    } else if (residence.countryId) {
      const countryData = await worldService.getCountryById(residence.countryId);
      if (countryData) {
        country = {
          countryId: countryData.countryId,
          name: countryData.name,
          code: countryData.code,
        };
      }
    }

    return {
      globalUserId: residence.globalUserId,
      country,
      state,
      city,
      timezone: residence.timezone,
      currency: residence.currency,
      languages: residence.languages,
      createdAt: residence.createdAt,
      updatedAt: residence.updatedAt,
    };
  }
}

export const residenceService = new ResidenceService();

















