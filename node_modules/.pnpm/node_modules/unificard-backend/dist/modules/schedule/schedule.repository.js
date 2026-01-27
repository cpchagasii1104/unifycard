"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleRepository = void 0;
// src/modules/schedule/schedule.repository.ts
const pool_1 = require("@core/database/pool");
class ScheduleRepository {
    /**
     * Busca agenda por ID
     */
    async findById(tenantId, scheduleId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT schedule_id, tenant_id, global_user_id, company_id, service_id, metadata, created_at, updated_at
      FROM schedules
      WHERE schedule_id = $1
      LIMIT 1
      `, [scheduleId]);
        return row || null;
    }
    /**
     * Busca agenda por usuário global
     */
    async findByGlobalUserId(tenantId, globalUserId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT schedule_id, tenant_id, global_user_id, company_id, service_id, metadata, created_at, updated_at
      FROM schedules
      WHERE global_user_id = $1
      LIMIT 1
      `, [globalUserId]);
        return row || null;
    }
    /**
     * Busca agenda por empresa
     */
    async findByCompanyId(tenantId, companyId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT schedule_id, tenant_id, global_user_id, company_id, service_id, metadata, created_at, updated_at
      FROM schedules
      WHERE company_id = $1
      LIMIT 1
      `, [companyId]);
        return row || null;
    }
    /**
     * Busca agenda por serviço
     */
    async findByServiceId(tenantId, serviceId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT schedule_id, tenant_id, global_user_id, company_id, service_id, metadata, created_at, updated_at
      FROM schedules
      WHERE service_id = $1
      LIMIT 1
      `, [serviceId]);
        return row || null;
    }
    /**
     * Cria uma nova agenda
     */
    async create(data) {
        const row = await (0, pool_1.runQueryWithTenant)(data.tenantId, `
      INSERT INTO schedules (tenant_id, global_user_id, company_id, service_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING schedule_id, tenant_id, global_user_id, company_id, service_id, metadata, created_at, updated_at
      `, [
            data.tenantId,
            data.globalUserId ?? null,
            data.companyId ?? null,
            data.serviceId ?? null,
            JSON.stringify(data.metadata),
        ]);
        if (!row) {
            throw new Error('Falha ao criar agenda');
        }
        return row;
    }
    /**
     * Busca slots de uma agenda
     */
    async findSlotsBySchedule(tenantId, scheduleId, options = {}) {
        const { startDate, endDate, status } = options;
        let query = `
      SELECT slot_id, schedule_id, start_time, end_time, status, reserved_by_global_user_id, reserved_via_action_id, metadata, created_at, updated_at
      FROM schedule_slots
      WHERE schedule_id = $1
    `;
        const params = [scheduleId];
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
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, query, params);
        return rows;
    }
    /**
     * Cria um novo slot
     */
    async createSlot(data) {
        const row = await (0, pool_1.runQueryWithTenant)(data.tenantId, `
      INSERT INTO schedule_slots (schedule_id, start_time, end_time, status, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING slot_id, schedule_id, start_time, end_time, status, reserved_by_global_user_id, reserved_via_action_id, metadata, created_at, updated_at
      `, [
            data.scheduleId,
            data.startTime,
            data.endTime,
            data.status,
            JSON.stringify(data.metadata),
        ]);
        if (!row) {
            throw new Error('Falha ao criar slot');
        }
        return row;
    }
    /**
     * Busca slot por ID
     */
    async findSlotById(tenantId, slotId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT slot_id, schedule_id, start_time, end_time, status, reserved_by_global_user_id, reserved_via_action_id, metadata, created_at, updated_at
      FROM schedule_slots
      WHERE slot_id = $1
      LIMIT 1
      `, [slotId]);
        return row || null;
    }
    /**
     * Reserva um slot
     */
    async reserveSlot(tenantId, slotId, globalUserId, actionId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      UPDATE schedule_slots
      SET status = 'reserved',
          reserved_by_global_user_id = $1,
          reserved_via_action_id = $2,
          updated_at = now()
      WHERE slot_id = $3 AND status = 'available'
      RETURNING slot_id, schedule_id, start_time, end_time, status, reserved_by_global_user_id, reserved_via_action_id, metadata, created_at, updated_at
      `, [globalUserId, actionId ?? null, slotId]);
        return row || null;
    }
    /**
     * Libera um slot (volta para available)
     */
    async releaseSlot(tenantId, slotId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      UPDATE schedule_slots
      SET status = 'available',
          reserved_by_global_user_id = NULL,
          reserved_via_action_id = NULL,
          updated_at = now()
      WHERE slot_id = $1
      RETURNING slot_id, schedule_id, start_time, end_time, status, reserved_by_global_user_id, reserved_via_action_id, metadata, created_at, updated_at
      `, [slotId]);
        return row || null;
    }
}
exports.ScheduleRepository = ScheduleRepository;
