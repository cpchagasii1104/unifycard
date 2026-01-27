"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleSlotModel = exports.ScheduleModel = void 0;
class ScheduleModel {
    static fromRow(row) {
        return {
            scheduleId: row.schedule_id,
            tenantId: row.tenant_id,
            globalUserId: row.global_user_id,
            companyId: row.company_id,
            serviceId: row.service_id,
            metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    static fromRows(rows) {
        return rows.map((row) => this.fromRow(row));
    }
    static toRow(schedule) {
        const row = {};
        if (schedule.scheduleId !== undefined)
            row.schedule_id = schedule.scheduleId;
        if (schedule.tenantId !== undefined)
            row.tenant_id = schedule.tenantId;
        if (schedule.globalUserId !== undefined)
            row.global_user_id = schedule.globalUserId;
        if (schedule.companyId !== undefined)
            row.company_id = schedule.companyId;
        if (schedule.serviceId !== undefined)
            row.service_id = schedule.serviceId;
        if (schedule.metadata !== undefined)
            row.metadata = schedule.metadata;
        return row;
    }
}
exports.ScheduleModel = ScheduleModel;
class ScheduleSlotModel {
    static fromRow(row) {
        return {
            slotId: row.slot_id,
            scheduleId: row.schedule_id,
            startTime: row.start_time,
            endTime: row.end_time,
            status: row.status,
            reservedByGlobalUserId: row.reserved_by_global_user_id,
            reservedViaActionId: row.reserved_via_action_id,
            metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    static fromRows(rows) {
        return rows.map((row) => this.fromRow(row));
    }
    static toRow(slot) {
        const row = {};
        if (slot.slotId !== undefined)
            row.slot_id = slot.slotId;
        if (slot.scheduleId !== undefined)
            row.schedule_id = slot.scheduleId;
        if (slot.startTime !== undefined)
            row.start_time = slot.startTime;
        if (slot.endTime !== undefined)
            row.end_time = slot.endTime;
        if (slot.status !== undefined)
            row.status = slot.status;
        if (slot.reservedByGlobalUserId !== undefined)
            row.reserved_by_global_user_id = slot.reservedByGlobalUserId;
        if (slot.reservedViaActionId !== undefined)
            row.reserved_via_action_id = slot.reservedViaActionId;
        if (slot.metadata !== undefined)
            row.metadata = slot.metadata;
        return row;
    }
}
exports.ScheduleSlotModel = ScheduleSlotModel;
