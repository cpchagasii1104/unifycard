"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RootConfigModel = void 0;
class RootConfigModel {
    /**
     * Converte row do banco para objeto RootConfig
     */
    static fromRow(row) {
        return {
            id: row.id,
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
}
exports.RootConfigModel = RootConfigModel;
