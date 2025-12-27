import type { ScheduleRow, ScheduleSlotRow } from './schedule.types';
export declare class ScheduleRepository {
    /**
     * Busca agenda por ID
     */
    findById(tenantId: string, scheduleId: string): Promise<ScheduleRow | null>;
    /**
     * Busca agenda por usuário global
     */
    findByGlobalUserId(tenantId: string, globalUserId: string): Promise<ScheduleRow | null>;
    /**
     * Busca agenda por empresa
     */
    findByCompanyId(tenantId: string, companyId: string): Promise<ScheduleRow | null>;
    /**
     * Busca agenda por serviço
     */
    findByServiceId(tenantId: string, serviceId: string): Promise<ScheduleRow | null>;
    /**
     * Cria uma nova agenda
     */
    create(data: {
        tenantId: string;
        globalUserId?: string | null;
        companyId?: string | null;
        serviceId?: string | null;
        metadata: Record<string, any>;
    }): Promise<ScheduleRow>;
    /**
     * Busca slots de uma agenda
     */
    findSlotsBySchedule(tenantId: string, scheduleId: string, options?: {
        startDate?: Date;
        endDate?: Date;
        status?: string;
    }): Promise<ScheduleSlotRow[]>;
    /**
     * Cria um novo slot
     */
    createSlot(data: {
        scheduleId: string;
        tenantId: string;
        startTime: Date;
        endTime: Date;
        status: string;
        metadata: Record<string, any>;
    }): Promise<ScheduleSlotRow>;
    /**
     * Busca slot por ID
     */
    findSlotById(tenantId: string, slotId: string): Promise<ScheduleSlotRow | null>;
    /**
     * Reserva um slot
     */
    reserveSlot(tenantId: string, slotId: string, globalUserId: string, actionId?: string | null): Promise<ScheduleSlotRow | null>;
    /**
     * Libera um slot (volta para available)
     */
    releaseSlot(tenantId: string, slotId: string): Promise<ScheduleSlotRow | null>;
}
//# sourceMappingURL=schedule.repository.d.ts.map