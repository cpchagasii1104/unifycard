"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CityRepository = void 0;
// src/core/world/repositories/city.repository.ts
const db_1 = require("@core/db");
class CityRepository {
    /**
     * Busca todas as cidades de um estado
     */
    async findByStateId(stateId) {
        return (0, db_1.runSystemQuery)({
            text: `
        SELECT 
          city_id,
          state_id,
          name,
          name_en,
          latitude,
          longitude,
          createdAt,
          updatedAt
        FROM cities
        WHERE state_id = $1
        ORDER BY name ASC
      `,
            values: [stateId],
        });
    }
    /**
     * Busca cidade por ID
     */
    async findById(cityId) {
        const rows = await (0, db_1.runSystemQuery)({
            text: `
        SELECT 
          city_id,
          state_id,
          name,
          name_en,
          latitude,
          longitude,
          createdAt,
          updatedAt
        FROM cities
        WHERE city_id = $1
      `,
            values: [cityId],
        });
        return rows[0];
    }
    /**
     * Busca cidades por termo (busca em nome e nome em inglês)
     */
    async search(term, countryId, stateId, limit = 20, offset = 0) {
        const searchTerm = `%${term}%`;
        let query = `
      SELECT 
        c.city_id,
        c.state_id,
        c.name,
        c.name_en,
        c.latitude,
        c.longitude,
        c.createdAt,
        c.updatedAt
      FROM cities c
      INNER JOIN states s ON c.state_id = s.state_id
      WHERE (
        UPPER(c.name) LIKE UPPER($1)
        OR UPPER(c.name_en) LIKE UPPER($1)
      )
    `;
        const values = [searchTerm];
        let paramIndex = 2;
        if (stateId) {
            query += ` AND c.state_id = $${paramIndex}`;
            values.push(stateId);
            paramIndex++;
        }
        else if (countryId) {
            query += ` AND s.country_id = $${paramIndex}`;
            values.push(countryId);
            paramIndex++;
        }
        query += ` ORDER BY c.name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        values.push(limit, offset);
        return (0, db_1.runSystemQuery)({
            text: query,
            values,
        });
    }
}
exports.CityRepository = CityRepository;
