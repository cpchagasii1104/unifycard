// src/services/employee/EmployeeService.ts
import { runTenantTransaction, runQueryWithTenant } from '@core/db';

interface EmploymentRow {
  company_employee_id: string;
  company_id: string;
  global_user_id: string;
  tenant_id: string;
  started_at: Date;
  ended_at: Date | null;
  role: string;
  can_manage_schedule: boolean;
  can_manage_services: boolean;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

interface ScheduleRow {
  schedule_id: string;
}

export class EmployeeService {
  /**
   * Contrata funcionário
   * 🔴 CRÍTICO: Cria agenda pessoal automaticamente
   */
  async hireEmployee(params: {
    companyId: string;
    userId: string;
    tenantId: string;
    role: 'owner' | 'admin' | 'manager' | 'staff';
  }): Promise<EmploymentRow> {
    const { companyId, userId, tenantId, role } = params;

    return runTenantTransaction(tenantId, async (trx) => {
      // 1. Cria vínculo
      const employmentResult = await trx.query({
        text: `
          INSERT INTO company_employees (
            company_id,
            global_user_id,
            tenant_id,
            role
          )
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `,
        values: [companyId, userId, tenantId, role],
      });

      if (employmentResult.length === 0) {
        throw new Error('Failed to create employment');
      }

      const employment = employmentResult[0] as EmploymentRow;

      // 2. 🔴 CRÍTICO: Garante agenda pessoal
      // Usa raw SQL com WHERE NOT EXISTS para evitar race condition
      await trx.query({
        text: `
          INSERT INTO schedules (global_user_id, tenant_id, metadata)
          SELECT $1, $2, $3::jsonb
          WHERE NOT EXISTS (
            SELECT 1 FROM schedules WHERE global_user_id = $1
          )
        `,
        values: [
          userId,
          tenantId,
          JSON.stringify({ timezone: 'America/Sao_Paulo' }),
        ],
      });

      return employment;
    });
  }

  /**
   * Demite funcionário
   */
  async terminateEmployee(params: {
    companyId: string;
    employeeId: string;
    tenantId: string;
    reason?: string;
  }): Promise<{ success: boolean }> {
    const { companyId, employeeId, tenantId, reason } = params;

    return runTenantTransaction(tenantId, async (trx) => {
      const now = new Date();

      // 1. Encerra vínculo
      await trx.query({
        text: `
          UPDATE company_employees
          SET 
            ended_at = $1,
            metadata = metadata || $2::jsonb,
            updated_at = NOW()
          WHERE company_id = $3
            AND global_user_id = $4
            AND ended_at IS NULL
        `,
        values: [
          now,
          JSON.stringify({ termination_reason: reason || null }),
          companyId,
          employeeId,
        ],
      });

      // 2. Libera slots futuros
      const personalScheduleResult = await trx.query({
        text: `
          SELECT schedule_id
          FROM schedules
          WHERE global_user_id = $1
        `,
        values: [employeeId],
      });

      if (personalScheduleResult.length > 0) {
        const personalSchedule = personalScheduleResult[0] as ScheduleRow;

        await trx.query({
          text: `
            UPDATE schedule_slots
            SET 
              status = 'available',
              reserved_by_global_user_id = NULL,
              reserved_via_action_id = NULL,
              updated_at = NOW()
            WHERE schedule_id = $1
              AND start_time > $2
              AND status = 'reserved'
          `,
          values: [personalSchedule.schedule_id, now],
        });
      }

      // 3. Ledger NÃO é tocado (imutável)

      return { success: true };
    });
  }
}















