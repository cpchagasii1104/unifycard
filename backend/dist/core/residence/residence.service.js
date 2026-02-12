"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.residenceService = void 0;
// src/core/residence/residence.service.ts
const pool_1 = require("@core/database/pool");
const world_service_1 = require("../world/services/world.service");
const root_config_service_1 = require("../root-config/root-config.service");
class ResidenceService {
    toUserResidence(row) {
        return {
            globalUserId: row.global_user_id,
            countryId: row.country_id,
            stateId: row.state_id,
            cityId: row.city_id,
            timezone: row.timezone,
            currency: row.currency,
            languages: row.languages || [],
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }
    /**
     * Busca residência digital de um usuário global
     */
    async getUserResidence(globalUserId) {
        const result = await pool_1.pool.query(`
      SELECT global_user_id, country_id, state_id, city_id, timezone, currency, languages, createdAt, updatedAt
      FROM global_user_residence
      WHERE global_user_id = $1
      LIMIT 1
      `, [globalUserId]);
        if (!result.rows[0]) {
            return null;
        }
        return this.toUserResidence(result.rows[0]);
    }
    /**
     * Define ou atualiza residência digital de um usuário
     */
    async setUserResidence(globalUserId, input) {
        // Obter root-config como fallback
        const rootConfig = await root_config_service_1.rootConfigService.getConfig();
        // Determinar valores finais (input tem prioridade sobre root-config)
        let finalCountryId = input.countryId ?? rootConfig?.countryId ?? null;
        let finalStateId = input.stateId ?? rootConfig?.stateId ?? null;
        let finalCityId = input.cityId ?? rootConfig?.cityId ?? null;
        let finalTimezone = input.timezone ?? rootConfig?.timezone ?? null;
        let finalCurrency = input.currency ?? rootConfig?.currency ?? 'BRL';
        let finalLanguages = input.languages ?? rootConfig?.languages ?? [];
        // Se cityId foi fornecido, validar e obter stateId/countryId automaticamente
        if (finalCityId) {
            const cityPath = await world_service_1.worldService.getCityFullPath(finalCityId);
            if (!cityPath) {
                throw new Error('Cidade não encontrada');
            }
            finalStateId = cityPath.state.stateId;
            finalCountryId = cityPath.country.countryId;
        }
        else if (finalStateId) {
            // Se stateId foi fornecido, validar e obter countryId automaticamente
            const state = await world_service_1.worldService.getStateById(finalStateId);
            if (!state) {
                throw new Error('Estado não encontrado');
            }
            finalCountryId = state.countryId;
        }
        else if (finalCountryId) {
            // Validar se país existe
            const country = await world_service_1.worldService.getCountryById(finalCountryId);
            if (!country) {
                throw new Error('País não encontrado');
            }
        }
        // Validar hierarquia se todos os campos foram fornecidos
        if (finalStateId && finalCountryId) {
            const state = await world_service_1.worldService.getStateById(finalStateId);
            if (!state || state.countryId !== finalCountryId) {
                throw new Error('Estado não pertence ao país especificado');
            }
        }
        if (finalCityId && finalStateId) {
            const city = await world_service_1.worldService.getCityById(finalCityId);
            if (!city || city.stateId !== finalStateId) {
                throw new Error('Cidade não pertence ao estado especificado');
            }
        }
        // Upsert residência
        const result = await pool_1.pool.query(`
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
        updatedAt = now()
      RETURNING global_user_id, country_id, state_id, city_id, timezone, currency, languages, createdAt, updatedAt
      `, [
            globalUserId,
            finalCountryId,
            finalStateId,
            finalCityId,
            finalTimezone,
            finalCurrency,
            finalLanguages,
        ]);
        return this.toUserResidence(result.rows[0]);
    }
    /**
     * Define apenas preferências (timezone, currency, languages)
     */
    async setResidencePreferences(globalUserId, preferences) {
        // Buscar residência atual
        const current = await this.getUserResidence(globalUserId);
        if (!current) {
            // Se não existe, criar com root-config como base
            const rootConfig = await root_config_service_1.rootConfigService.getConfig();
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
    async autoSetFromRootConfig(globalUserId) {
        const rootConfig = await root_config_service_1.rootConfigService.getConfig();
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
    async getResidenceWithDetails(globalUserId) {
        const residence = await this.getUserResidence(globalUserId);
        if (!residence) {
            return null;
        }
        let country = null;
        let state = null;
        let city = null;
        if (residence.cityId) {
            const cityPath = await world_service_1.worldService.getCityFullPath(residence.cityId);
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
        }
        else if (residence.stateId) {
            const stateData = await world_service_1.worldService.getStateById(residence.stateId);
            if (stateData) {
                const countryData = await world_service_1.worldService.getCountryById(stateData.countryId);
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
        }
        else if (residence.countryId) {
            const countryData = await world_service_1.worldService.getCountryById(residence.countryId);
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
exports.residenceService = new ResidenceService();
