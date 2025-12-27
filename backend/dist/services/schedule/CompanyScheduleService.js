"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyScheduleService = void 0;
// src/services/schedule/CompanyScheduleService.ts
const db_1 = require("@core/db");
class CompanyScheduleService {
    /**
     * Cria ou atualiza agenda da empresa
     */
    async ensureCompanySchedule(params) {
        const { companyId, tenantId, timezone, businessHours } = params;
        return (0, db_1.runTenantTransaction)(tenantId, async (trx) => {
            // Verifica se já existe
            const existingResult = await trx.query({
                text: `
          SELECT schedule_id, company_id, tenant_id, metadata
          FROM schedules
          WHERE company_id = $1
        `,
                values: [companyId],
            });
            if (existingResult.length > 0) {
                const existing = existingResult[0];
                // Atualiza metadata
                await trx.query({
                    text: `
            UPDATE schedules
            SET 
              metadata = $1::jsonb,
              updated_at = NOW()
            WHERE schedule_id = $2
          `,
                    values: [
                        JSON.stringify({
                            timezone,
                            business_hours: businessHours,
                        }),
                        existing.schedule_id,
                    ],
                });
                return existing.schedule_id;
            }
            // Cria novo
            const newScheduleResult = await trx.query({
                text: `
          INSERT INTO schedules (
            company_id,
            tenant_id,
            metadata
          )
          VALUES ($1, $2, $3::jsonb)
          RETURNING schedule_id
        `,
                values: [
                    companyId,
                    tenantId,
                    JSON.stringify({
                        timezone,
                        business_hours: businessHours,
                    }),
                ],
            });
            if (newScheduleResult.length === 0) {
                throw new Error('Failed to create schedule');
            }
            const newSchedule = newScheduleResult[0];
            return newSchedule.schedule_id;
        });
    }
}
exports.CompanyScheduleService = CompanyScheduleService;
//# sourceMappingURL=CompanyScheduleService.js.map