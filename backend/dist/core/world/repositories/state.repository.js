"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateRepository = void 0;
// src/core/world/repositories/state.repository.ts
const db_1 = require("@core/db");
class StateRepository {
    /**
     * Busca todos os estados de um país
     */
    async findByCountryId(countryId) {
        return (0, db_1.runSystemQuery)({
            text: `
        SELECT 
          state_id,
          country_id,
          code,
          name,
          name_en,
          createdAt,
          updatedAt
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
    async findById(stateId) {
        const rows = await (0, db_1.runSystemQuery)({
            text: `
        SELECT 
          state_id,
          country_id,
          code,
          name,
          name_en,
          createdAt,
          updatedAt
        FROM states
        WHERE state_id = $1
      `,
            values: [stateId],
        });
        return rows[0];
    }
}
exports.StateRepository = StateRepository;
