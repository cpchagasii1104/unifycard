export type SlotStatus = 'available' | 'reserved' | 'blocked';
export interface Schedule {
    scheduleId: string;
    tenantId: string;
    globalUserId: string | null;
    companyId: string | null;
    serviceId: string | null;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export interface ScheduleRow {
    schedule_id: string;
    tenant_id: string;
    global_user_id: string | null;
    company_id: string | null;
    service_id: string | null;
    metadata: any;
    created_at: Date;
    updated_at: Date;
}
export interface ScheduleSlot {
    slotId: string;
    scheduleId: string;
    startTime: Date;
    endTime: Date;
    status: SlotStatus;
    reservedByGlobalUserId: string | null;
    reservedViaActionId: string | null;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export interface ScheduleSlotRow {
    slot_id: string;
    schedule_id: string;
    start_time: Date;
    end_time: Date;
    status: string;
    reserved_by_global_user_id: string | null;
    reserved_via_action_id: string | null;
    metadata: any;
    created_at: Date;
    updated_at: Date;
}
export interface CreateScheduleInput {
    globalUserId?: string | null;
    companyId?: string | null;
    serviceId?: string | null;
    metadata?: Record<string, any>;
}
export interface AddSlotInput {
    startTime: Date;
    endTime: Date;
    status?: SlotStatus;
    metadata?: Record<string, any>;
}
export interface ReserveSlotInput {
    slotId: string;
    actionId?: string;
    metadata?: Record<string, any>;
}
export interface ScheduleWithSlots extends Schedule {
    slots?: ScheduleSlot[];
    availableSlots?: number;
    reservedSlots?: number;
    blockedSlots?: number;
}
export interface SlotAvailability {
    date: string;
    availableSlots: number;
    reservedSlots: number;
    slots: ScheduleSlot[];
}
//# sourceMappingURL=schedule.types.d.ts.map