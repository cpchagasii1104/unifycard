"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.worldService = void 0;
// src/core/world/services/world.service.ts
const country_repository_1 = require("../repositories/country.repository");
const state_repository_1 = require("../repositories/state.repository");
const city_repository_1 = require("../repositories/city.repository");
const country_model_1 = require("../models/country.model");
const state_model_1 = require("../models/state.model");
const city_model_1 = require("../models/city.model");
class WorldService {
    countryRepo = new country_repository_1.CountryRepository();
    stateRepo = new state_repository_1.StateRepository();
    cityRepo = new city_repository_1.CityRepository();
    /**
     * Lista todos os países
     */
    async getCountries() {
        const rows = await this.countryRepo.findAll();
        return country_model_1.CountryModel.fromRows(rows);
    }
    /**
     * Busca país por ID
     */
    async getCountryById(countryId) {
        const row = await this.countryRepo.findById(countryId);
        return row ? country_model_1.CountryModel.fromRow(row) : null;
    }
    /**
     * Busca país por código ISO
     */
    async getCountryByCode(code) {
        const row = await this.countryRepo.findByCode(code);
        return row ? country_model_1.CountryModel.fromRow(row) : null;
    }
    /**
     * Lista todos os estados de um país
     */
    async getStatesByCountry(countryId) {
        const rows = await this.stateRepo.findByCountryId(countryId);
        return state_model_1.StateModel.fromRows(rows);
    }
    /**
     * Busca estado por ID
     */
    async getStateById(stateId) {
        const row = await this.stateRepo.findById(stateId);
        return row ? state_model_1.StateModel.fromRow(row) : null;
    }
    /**
     * Lista todas as cidades de um estado
     */
    async getCitiesByState(stateId) {
        const rows = await this.cityRepo.findByStateId(stateId);
        return city_model_1.CityModel.fromRows(rows);
    }
    /**
     * Busca cidade por ID
     */
    async getCityById(cityId) {
        const row = await this.cityRepo.findById(cityId);
        return row ? city_model_1.CityModel.fromRow(row) : null;
    }
    /**
     * Busca cidades por termo
     */
    async searchCities(term, options) {
        const limit = options?.limit ?? 20;
        const offset = options?.offset ?? 0;
        const rows = await this.cityRepo.search(term, options?.countryId, options?.stateId, limit, offset);
        return city_model_1.CityModel.fromRows(rows);
    }
    /**
     * Busca caminho completo de uma cidade (cidade → estado → país)
     */
    async getCityFullPath(cityId) {
        const city = await this.getCityById(cityId);
        if (!city) {
            return null;
        }
        const state = await this.getStateById(city.stateId);
        if (!state) {
            return null;
        }
        const country = await this.getCountryById(state.countryId);
        if (!country) {
            return null;
        }
        return {
            city: {
                cityId: city.cityId,
                name: city.name,
                nameEn: city.nameEn,
            },
            state: {
                stateId: state.stateId,
                name: state.name,
                nameEn: state.nameEn,
                code: state.code,
            },
            country: {
                countryId: country.countryId,
                name: country.name,
                nameEn: country.nameEn,
                code: country.code,
            },
        };
    }
}
exports.worldService = new WorldService();
//# sourceMappingURL=world.service.js.map