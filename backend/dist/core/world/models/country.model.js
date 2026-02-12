"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CountryModel = void 0;
class CountryModel {
    /**
     * Converte row do banco para objeto Country
     */
    static fromRow(row) {
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
    static fromRows(rows) {
        return rows.map(row => this.fromRow(row));
    }
}
exports.CountryModel = CountryModel;
