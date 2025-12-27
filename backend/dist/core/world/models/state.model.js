"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateModel = void 0;
class StateModel {
    /**
     * Converte row do banco para objeto State
     */
    static fromRow(row) {
        return {
            stateId: row.state_id,
            countryId: row.country_id,
            code: row.code,
            name: row.name,
            nameEn: row.name_en,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    /**
     * Converte array de rows para array de States
     */
    static fromRows(rows) {
        return rows.map(row => this.fromRow(row));
    }
}
exports.StateModel = StateModel;
//# sourceMappingURL=state.model.js.map