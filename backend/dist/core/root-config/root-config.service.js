"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rootConfigService = void 0;
// src/core/root-config/root-config.service.ts
const root_config_repository_1 = require("./root-config.repository");
const root_config_model_1 = require("./root-config.model");
const world_service_1 = require("../world/services/world.service");
class RootConfigService {
    repository = new root_config_repository_1.RootConfigRepository();
    /**
     * Busca a configuração-raiz atual
     */
    async getConfig() {
        const row = await this.repository.find();
        return row ? root_config_model_1.RootConfigModel.fromRow(row) : null;
    }
    /**
     * Atualiza a configuração-raiz
     */
    async updateConfig(input) {
        // Validações de referências
        if (input.countryId) {
            const country = await world_service_1.worldService.getCountryById(input.countryId);
            if (!country) {
                throw new Error('País não encontrado');
            }
        }
        if (input.stateId) {
            const state = await world_service_1.worldService.getStateById(input.stateId);
            if (!state) {
                throw new Error('Estado não encontrado');
            }
            // Se stateId fornecido, garantir que countryId está correto
            if (input.countryId && state.countryId !== input.countryId) {
                throw new Error('Estado não pertence ao país especificado');
            }
        }
        if (input.cityId) {
            const city = await world_service_1.worldService.getCityById(input.cityId);
            if (!city) {
                throw new Error('Cidade não encontrada');
            }
            // Se cityId fornecido, garantir que stateId está correto
            if (input.stateId && city.stateId !== input.stateId) {
                throw new Error('Cidade não pertence ao estado especificado');
            }
            // Se não forneceu stateId mas forneceu cityId, buscar stateId da cidade
            if (!input.stateId) {
                input.stateId = city.stateId;
            }
        }
        const row = await this.repository.upsert(input);
        return root_config_model_1.RootConfigModel.fromRow(row);
    }
    /**
     * Define a região (país, estado, cidade)
     */
    async setRegion(countryId, stateId, cityId) {
        const input = {
            countryId: countryId ?? null,
            stateId: stateId ?? null,
            cityId: cityId ?? null,
        };
        return this.updateConfig(input);
    }
    /**
     * Define o timezone
     */
    async setTimezone(timezone) {
        return this.updateConfig({ timezone });
    }
    /**
     * Define a moeda
     */
    async setCurrency(currency) {
        return this.updateConfig({ currency });
    }
    /**
     * Define os idiomas
     */
    async setLanguages(languages) {
        return this.updateConfig({ languages });
    }
}
exports.rootConfigService = new RootConfigService();
//# sourceMappingURL=root-config.service.js.map