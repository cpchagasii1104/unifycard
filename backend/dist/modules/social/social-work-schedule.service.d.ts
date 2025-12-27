import type { Job } from '../work/work.types';
import type { ScheduleSlot } from '../schedule/schedule.types';
declare class SocialWorkScheduleService {
    /**
     * Resolve job a partir de um post
     * Reutiliza método do socialWorkService
     */
    resolveJobFromPost(postId: string, tenantId: string): Promise<Job | null>;
    /**
     * Resolve global_user_id a partir de user_id
     */
    private resolveGlobalUserId;
    /**
     * Cria um agendamento (schedule) a partir de um post
     * Cria ou busca schedule do cliente (quem criou o job)
     * Adiciona um slot reservado para o horário solicitado
     */
    createScheduleFromPost(postId: string, tenantId: string, customerUserId: string, startTime: Date, endTime: Date): Promise<ScheduleSlot>;
    /**
     * Lista agendamentos (slots reservados) vinculados ao job do post
     */
    getSchedulesForPost(postId: string, tenantId: string): Promise<ScheduleSlot[]>;
}
export declare const socialWorkScheduleService: SocialWorkScheduleService;
export {};
//# sourceMappingURL=social-work-schedule.service.d.ts.map