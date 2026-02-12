"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CountryRepository = void 0;
// src/core/world/repositories/country.repository.ts
const db_1 = require("@core/db");
class CountryRepository {
    /**
     * Busca todos os países
     */
    async findAll() {
        return (0, db_1.runSystemQuery)({
            text: `
        SELECT 
          country_id,
          code,
          name,
          name_en,
          createdAt,
          updatedAt
        FROM countries
        ORDER BY name ASC
      `,
        });
    }
    /**
     * Busca país por ID
     */
    async findById(countryId) {
        const rows = await (0, db_1.runSystemQuery)({
            text: `
        SELECT 
          country_id,
          code,
          name,
          name_en,
          createdAt,
          updatedAt
        FROM countries
        WHERE country_id = $1
      `,
            values: [countryId],
        });
        return rows[0];
    }
    /**
     * Busca país por código ISO
     */
    async findByCode(code) {
        const rows = await (0, db_1.runSystemQuery)({
            text: `
        SELECT 
          country_id,
          code,
          name,
          name_en,
          createdAt,
          updatedAt
        FROM countries
        WHERE UPPER(code) = UPPER($1)
      `,
            values: [code],
        });
        return rows[0];
    }
}
exports.CountryRepository = CountryRepository;
