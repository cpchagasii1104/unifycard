"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RootConfigRepository = void 0;
// src/core/root-config/root-config.repository.ts
const db_1 = require("@core/db");
class RootConfigRepository {
    /**
     * Busca a configuração-raiz (só deve existir uma)
     */
    async find() {
        const rows = await (0, db_1.runSystemQuery)({
            text: `
        SELECT 
          id,
          country_id,
          state_id,
          city_id,
          timezone,
          currency,
          languages,
          createdAt,
          updatedAt
        FROM root_config
        ORDER BY createdAt ASC
        LIMIT 1
      `,
        });
        return rows[0];
    }
    /**
     * Cria ou atualiza a configuração-raiz
     */
    async upsert(input) {
        return (0, db_1.runSystemTransaction)(async (trx) => {
            // Verifica se já existe
            const existing = await trx.query({
                text: 'SELECT id FROM root_config LIMIT 1',
            });
            if (existing.length > 0) {
                // Atualiza
                const updateFields = [];
                const values = [];
                let paramIndex = 1;
                if (input.countryId !== undefined) {
                    updateFields.push(`country_id = $${paramIndex}`);
                    values.push(input.countryId);
                    paramIndex++;
                }
                if (input.stateId !== undefined) {
                    updateFields.push(`state_id = $${paramIndex}`);
                    values.push(input.stateId);
                    paramIndex++;
                }
                if (input.cityId !== undefined) {
                    updateFields.push(`city_id = $${paramIndex}`);
                    values.push(input.cityId);
                    paramIndex++;
                }
                if (input.timezone !== undefined) {
                    updateFields.push(`timezone = $${paramIndex}`);
                    values.push(input.timezone);
                    paramIndex++;
                }
                if (input.currency !== undefined) {
                    updateFields.push(`currency = $${paramIndex}`);
                    values.push(input.currency);
                    paramIndex++;
                }
                if (input.languages !== undefined) {
                    updateFields.push(`languages = $${paramIndex}`);
                    values.push(input.languages);
                    paramIndex++;
                }
                updateFields.push(`updatedAt = now()`);
                values.push(existing[0].id);
                const result = await trx.query({
                    text: `
            UPDATE root_config
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
          `,
                    values,
                });
                return result[0];
            }
            else {
                // Cria
                const result = await trx.query({
                    text: `
            INSERT INTO root_config (
              country_id,
              state_id,
              city_id,
              timezone,
              currency,
              languages
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
          `,
                    values: [
                        input.countryId ?? null,
                        input.stateId ?? null,
                        input.cityId ?? null,
                        input.timezone ?? null,
                        input.currency ?? null,
                        input.languages ?? [],
                    ],
                });
                return result[0];
            }
        });
    }
}
exports.RootConfigRepository = RootConfigRepository;
