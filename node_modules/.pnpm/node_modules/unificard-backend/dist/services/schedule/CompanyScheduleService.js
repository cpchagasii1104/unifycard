"use strict";
// src/services/schedule/CompanyScheduleService.ts
// 🔴 DEPRECATED — Usa estrutura temporal paralela.
// 🔴 NÃO USAR EM NOVO CÓDIGO.
// 🔴 Migrar para unified-availability.service.ts
// 
// business_hours é apenas INPUT declarativo de horários de funcionamento.
// 
// REGRAS ABSOLUTAS:
// - NÃO bloqueia agenda
// - NÃO resolve conflito
// - NÃO cria booking
// - NÃO cria slots reais
// - NÃO interfere em Unified Availability
// 
// Esta estrutura serve apenas como:
// - INPUT para criação futura de Unified Availability (quando empresa confirmar)
// - READ-MODEL para exibição de horários declarados
// 
// A verdade temporal está exclusivamente em Unified Availability (tabela `availability`).
// 
// ⚠️ DEPRECATED: Este serviço está marcado como DEPRECATED.
// Não criar novas dependências. Migrar código existente para unified-availability.service.ts.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyScheduleService = void 0;
const db_1 = require("@core/db");
class CompanyScheduleService {
    /**
     * Cria ou atualiza agenda da empresa
     *
     * 🔴 FASE 2: Este método armazena apenas INPUT DECLARATIVO.
     * business_hours não bloqueia agenda, não resolve conflito, não cria booking.
     * A verdade temporal está em Unified Availability (tabela `availability`).
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
