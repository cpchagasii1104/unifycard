// src/services/schedule/AvailabilityResolver.ts
import { DateTime } from 'luxon';
import { runTenantTransaction, runQueryWithTenant } from '@core/db';

interface EmploymentRow {
  company_employee_id: string;
  company_id: string;
  global_user_id: string;
  ended_at: Date | null;
}

interface ScheduleRow {
  schedule_id: string;
}

interface SlotRow {
  slot_id: string;
  schedule_id: string;
  start_time: Date;
  end_time: Date;
  status: string;
}

export class AvailabilityResolver {
  async checkEmployeeAvailability(params: {
    employeeId: string;
    companyId: string;
    tenantId: string;
    serviceId?: string;
    startTime: DateTime;
    endTime: DateTime;
  }): Promise<{ available: boolean; reason?: string }> {
    const { employeeId, companyId, tenantId, startTime, endTime } = params;

    // 1. Funcionário ativo?
    const employment = await runQueryWithTenant<EmploymentRow>(
      tenantId,
      {
        text: `
          SELECT company_employee_id, company_id, global_user_id, ended_at
          FROM company_employees
          WHERE company_id = $1
            AND global_user_id = $2
            AND ended_at IS NULL
        `,
        values: [companyId, employeeId],
      }
    );

    if (!employment) {
      return { available: false, reason: 'Employee not active' };
    }

    // 2. Empresa operando?
    const companySchedule = await runQueryWithTenant<ScheduleRow>(
      tenantId,
      {
        text: `
          SELECT schedule_id
          FROM schedules
          WHERE company_id = $1
        `,
        values: [companyId],
      }
    );

    if (!companySchedule) {
      return { available: false, reason: 'Company has no schedule' };
    }

    const companySlot = await runQueryWithTenant<SlotRow>(
      tenantId,
      {
        text: `
          SELECT slot_id, schedule_id, start_time, end_time, status
          FROM schedule_slots
          WHERE schedule_id = $1
            AND status = 'available'
            AND tstzrange(start_time, end_time) @> tstzrange($2, $3)
          LIMIT 1
        `,
        values: [
          companySchedule.schedule_id,
          startTime.toISO(),
          endTime.toISO(),
        ],
      }
    );

    if (!companySlot) {
      return { available: false, reason: 'Company not operating' };
    }

    // 3. Conflito pessoal?
    const personalSchedule = await runQueryWithTenant<ScheduleRow>(
      tenantId,
      {
        text: `
          SELECT schedule_id
          FROM schedules
          WHERE global_user_id = $1
        `,
        values: [employeeId],
      }
    );

    if (personalSchedule) {
      const conflict = await runQueryWithTenant<SlotRow>(
        tenantId,
        {
          text: `
            SELECT slot_id, schedule_id, start_time, end_time, status
            FROM schedule_slots
            WHERE schedule_id = $1
              AND status = 'reserved'
              AND tstzrange(start_time, end_time) && tstzrange($2, $3)
            LIMIT 1
          `,
          values: [
            personalSchedule.schedule_id,
            startTime.toISO(),
            endTime.toISO(),
          ],
        }
      );

      if (conflict) {
        return { available: false, reason: 'Employee has conflict' };
      }
    }

    return { available: true };
  }

  /**
   * Reserva slot com proteção contra overbooking
   */
  async reserveSlot(params: {
    scheduleId: string;
    slotId: string;
    userId: string;
    tenantId: string;
    actionId?: string;
  }): Promise<{ success: boolean }> {
    const { scheduleId, slotId, userId, tenantId, actionId } = params;

    return runTenantTransaction(tenantId, async (trx) => {
      // 1. 🔴 CRÍTICO: Validação de sobreposição ANTES de reservar
      const slotResult = await trx.query({
        text: `
          SELECT slot_id, schedule_id, start_time, end_time, status
          FROM schedule_slots
          WHERE slot_id = $1
        `,
        values: [slotId],
      });

      if (slotResult.length === 0) {
        throw new Error('Slot not found');
      }

      const slot = slotResult[0] as SlotRow;

      if (slot.schedule_id !== scheduleId) {
        throw new Error('Slot does not belong to this schedule');
      }

      // Verificar sobreposição
      const overlapResult = await trx.query({
        text: `
          SELECT slot_id
          FROM schedule_slots
          WHERE schedule_id = $1
            AND status = 'reserved'
            AND slot_id != $2
            AND tstzrange(start_time, end_time) && tstzrange($3, $4)
          LIMIT 1
        `,
        values: [
          scheduleId,
          slotId,
          slot.start_time,
          slot.end_time,
        ],
      });

      if (overlapResult.length > 0) {
        throw new Error('Time slot overlaps with existing reservation');
      }

      // 2. Lock otimista
      const updateResult = await trx.query({
        text: `
          UPDATE schedule_slots
          SET 
            status = 'reserved',
            reserved_by_global_user_id = $1,
            reserved_via_action_id = $2,
            updated_at = NOW()
          WHERE slot_id = $3
            AND status = 'available'
          RETURNING slot_id
        `,
        values: [userId, actionId || null, slotId],
      });

      if (updateResult.length === 0) {
        throw new Error('Slot no longer available');
      }

      return { success: true };
    });
  }
}















