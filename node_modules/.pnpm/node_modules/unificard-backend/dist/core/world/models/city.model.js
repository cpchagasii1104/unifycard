"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CityModel = void 0;
class CityModel {
    /**
     * Converte row do banco para objeto City
     */
    static fromRow(row) {
        return {
            cityId: row.city_id,
            stateId: row.state_id,
            name: row.name,
            nameEn: row.name_en,
            latitude: row.latitude,
            longitude: row.longitude,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    /**
     * Converte array de rows para array de Cities
     */
    static fromRows(rows) {
        return rows.map(row => this.fromRow(row));
    }
}
exports.CityModel = CityModel;
