import type { Schedule, ScheduleSlot, CreateScheduleInput, AddSlotInput, ReserveSlotInput, ScheduleWithSlots } from './schedule.types';
declare class ScheduleService {
    private repository;
    /**
     * Cria ou busca agenda existente para um usuário
     */
    getOrCreateUserSchedule(tenantId: string, globalUserId: string): Promise<Schedule>;
    /**
     * Cria ou busca agenda existente para uma empresa
     */
    getOrCreateCompanySchedule(tenantId: string, companyId: string): Promise<Schedule>;
    /**
     * Cria uma nova agenda manualmente
     */
    createSchedule(tenantId: string, input: CreateScheduleInput): Promise<Schedule>;
    /**
     * Busca agenda por ID
     */
    getSchedule(tenantId: string, scheduleId: string): Promise<Schedule | null>;
    /**
     * Busca agenda com slots
     */
    getScheduleWithSlots(tenantId: string, scheduleId: string, options?: {
        startDate?: Date;
        endDate?: Date;
    }): Promise<ScheduleWithSlots | null>;
    /**
     * Adiciona slot a uma agenda
     */
    addSlot(tenantId: string, scheduleId: string, input: AddSlotInput): Promise<ScheduleSlot>;
    /**
     * Reserva um slot
     */
    reserveSlot(tenantId: string, scheduleId: string, input: ReserveSlotInput, globalUserId: string): Promise<ScheduleSlot>;
    /**
     * Busca agenda por usuário global
     */
    getScheduleByUser(tenantId: string, globalUserId: string): Promise<Schedule | null>;
    /**
     * Busca agenda por empresa
     */
    getScheduleByCompany(tenantId: string, companyId: string): Promise<Schedule | null>;
}
export declare const scheduleService: ScheduleService;
export {};
//# sourceMappingURL=schedule.service.d.ts.map