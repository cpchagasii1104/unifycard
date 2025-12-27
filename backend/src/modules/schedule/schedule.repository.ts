// src/modules/schedule/schedule.repository.ts
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { ScheduleRow, ScheduleSlotRow } from './schedule.types';

export class ScheduleRepository {
  /**
   * Busca agenda por ID
   */
  async findById(tenantId: string, scheduleId: string): Promise<ScheduleRow | null> {
    const row = await runQueryWithTenant<ScheduleRow>(
      tenantId,
      `
      SELECT schedule_id, tenant_id, global_user_id, company_id, service_id, metadata, created_at, updated_at
      FROM schedules
      WHERE schedule_id = $1
      LIMIT 1
      `,
      [scheduleId]
    );

    return row || null;
  }

  /**
   * Busca agenda por usuário global
   */
  async findByGlobalUserId(tenantId: string, globalUserId: string): Promise<ScheduleRow | null> {
    const row = await runQueryWithTenant<ScheduleRow>(
      tenantId,
      `
      SELECT schedule_id, tenant_id, global_user_id, company_id, service_id, metadata, created_at, updated_at
      FROM schedules
      WHERE global_user_id = $1
      LIMIT 1
      `,
      [globalUserId]
    );

    return row || null;
  }

  /**
   * Busca agenda por empresa
   */
  async findByCompanyId(tenantId: string, companyId: string): Promise<ScheduleRow | null> {
    const row = await runQueryWithTenant<ScheduleRow>(
      tenantId,
      `
      SELECT schedule_id, tenant_id, global_user_id, company_id, service_id, metadata, created_at, updated_at
      FROM schedules
      WHERE company_id = $1
      LIMIT 1
      `,
      [companyId]
    );

    return row || null;
  }

  /**
   * Busca agenda por serviço
   */
  async findByServiceId(tenantId: string, serviceId: string): Promise<ScheduleRow | null> {
    const row = await runQueryWithTenant<ScheduleRow>(
      tenantId,
      `
      SELECT schedule_id, tenant_id, global_user_id, company_id, service_id, metadata, created_at, updated_at
      FROM schedules
      WHERE service_id = $1
      LIMIT 1
      `,
      [serviceId]
    );

    return row || null;
  }

  /**
   * Cria uma nova agenda
   */
  async create(data: {
    tenantId: string;
    globalUserId?: string | null;
    companyId?: string | null;
    serviceId?: string | null;
    metadata: Record<string, any>;
  }): Promise<ScheduleRow> {
    const row = await runQueryWithTenant<ScheduleRow>(
      data.tenantId,
      `
      INSERT INTO schedules (tenant_id, global_user_id, company_id, service_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING schedule_id, tenant_id, global_user_id, company_id, service_id, metadata, created_at, updated_at
      `,
      [
        data.tenantId,
        data.globalUserId ?? null,
        data.companyId ?? null,
        data.serviceId ?? null,
        JSON.stringify(data.metadata),
      ]
    );

    if (!row) {
      throw new Error('Falha ao criar agenda');
    }

    return row;
  }

  /**
   * Busca slots de uma agenda
   */
  async findSlotsBySchedule(
    tenantId: string,
    scheduleId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      status?: string;
    } = {}
  ): Promise<ScheduleSlotRow[]> {
    const { startDate, endDate, status } = options;

    let query = `
      SELECT slot_id, schedule_id, start_time, end_time, status, reserved_by_global_user_id, reserved_via_action_id, metadata, created_at, updated_at
      FROM schedule_slots
      WHERE schedule_id = $1
    `;

    const params: any[] = [scheduleId];
    let paramIndex = 2;

    if (startDate) {
      query += ` AND start_time >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND end_time <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY start_time ASC`;

    const rows = await runQueriesWithTenant<ScheduleSlotRow>(tenantId, query, params);

    return rows;
  }

  /**
   * Cria um novo slot
   */
  async createSlot(data: {
    scheduleId: string;
    tenantId: string;
    startTime: Date;
    endTime: Date;
    status: string;
    metadata: Record<string, any>;
  }): Promise<ScheduleSlotRow> {
    const row = await runQueryWithTenant<ScheduleSlotRow>(
      data.tenantId,
      `
      INSERT INTO schedule_slots (schedule_id, start_time, end_time, status, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING slot_id, schedule_id, start_time, end_time, status, reserved_by_global_user_id, reserved_via_action_id, metadata, created_at, updated_at
      `,
      [
        data.scheduleId,
        data.startTime,
        data.endTime,
        data.status,
        JSON.stringify(data.metadata),
      ]
    );

    if (!row) {
      throw new Error('Falha ao criar slot');
    }

    return row;
  }

  /**
   * Busca slot por ID
   */
  async findSlotById(tenantId: string, slotId: string): Promise<ScheduleSlotRow | null> {
    const row = await runQueryWithTenant<ScheduleSlotRow>(
      tenantId,
      `
      SELECT slot_id, schedule_id, start_time, end_time, status, reserved_by_global_user_id, reserved_via_action_id, metadata, created_at, updated_at
      FROM schedule_slots
      WHERE slot_id = $1
      LIMIT 1
      `,
      [slotId]
    );

    return row || null;
  }

  /**
   * Reserva um slot
   */
  async reserveSlot(
    tenantId: string,
    slotId: string,
    globalUserId: string,
    actionId?: string | null
  ): Promise<ScheduleSlotRow | null> {
    const row = await runQueryWithTenant<ScheduleSlotRow>(
      tenantId,
      `
      UPDATE schedule_slots
      SET status = 'reserved',
          reserved_by_global_user_id = $1,
          reserved_via_action_id = $2,
          updated_at = now()
      WHERE slot_id = $3 AND status = 'available'
      RETURNING slot_id, schedule_id, start_time, end_time, status, reserved_by_global_user_id, reserved_via_action_id, metadata, created_at, updated_at
      `,
      [globalUserId, actionId ?? null, slotId]
    );

    return row || null;
  }

  /**
   * Libera um slot (volta para available)
   */
  async releaseSlot(tenantId: string, slotId: string): Promise<ScheduleSlotRow | null> {
    const row = await runQueryWithTenant<ScheduleSlotRow>(
      tenantId,
      `
      UPDATE schedule_slots
      SET status = 'available',
          reserved_by_global_user_id = NULL,
          reserved_via_action_id = NULL,
          updated_at = now()
      WHERE slot_id = $1
      RETURNING slot_id, schedule_id, start_time, end_time, status, reserved_by_global_user_id, reserved_via_action_id, metadata, created_at, updated_at
      `,
      [slotId]
    );

    return row || null;
  }
}








