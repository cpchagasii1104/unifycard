// src/services/schedule/CompanyScheduleService.ts
import { runTenantTransaction, runQueryWithTenant } from '@core/db';

interface ScheduleRow {
  schedule_id: string;
  company_id: string;
  tenant_id: string;
  metadata: {
    timezone?: string;
    business_hours?: {
      monday?: { start: string; end: string };
      tuesday?: { start: string; end: string };
      wednesday?: { start: string; end: string };
      thursday?: { start: string; end: string };
      friday?: { start: string; end: string };
      saturday?: { start: string; end: string };
      sunday?: { start: string; end: string };
    };
  };
}

interface BusinessHours {
  monday?: { start: string; end: string };
  tuesday?: { start: string; end: string };
  wednesday?: { start: string; end: string };
  thursday?: { start: string; end: string };
  friday?: { start: string; end: string };
  saturday?: { start: string; end: string };
  sunday?: { start: string; end: string };
}

export class CompanyScheduleService {
  /**
   * Cria ou atualiza agenda da empresa
   */
  async ensureCompanySchedule(params: {
    companyId: string;
    tenantId: string;
    timezone: string;
    businessHours: BusinessHours;
  }): Promise<string> {
    const { companyId, tenantId, timezone, businessHours } = params;

    return runTenantTransaction(tenantId, async (trx) => {
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
        const existing = existingResult[0] as ScheduleRow;

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

      const newSchedule = newScheduleResult[0] as ScheduleRow;
      return newSchedule.schedule_id;
    });
  }
}















