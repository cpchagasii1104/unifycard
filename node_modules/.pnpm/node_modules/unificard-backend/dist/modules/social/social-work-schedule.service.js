"use strict";
// src/modules/social/social-work-schedule.service.ts
//
// Serviço de integração entre Social, Work e Schedule
// Permite agendar serviços publicados em posts diretamente
Object.defineProperty(exports, "__esModule", { value: true });
exports.socialWorkScheduleService = void 0;
const social_work_service_1 = require("./social-work.service");
const schedule_service_1 = require("../schedule/schedule.service");
const pool_1 = require("@core/database/pool");
class SocialWorkScheduleService {
    /**
     * Resolve job a partir de um post
     * Reutiliza método do socialWorkService
     */
    async resolveJobFromPost(postId, tenantId) {
        return social_work_service_1.socialWorkService.resolveJobFromPost(postId, tenantId);
    }
    /**
     * Resolve global_user_id a partir de user_id
     */
    async resolveGlobalUserId(tenantId, userId) {
        const result = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT global_user_id
      FROM users
      WHERE tenant_id = $1 AND user_id = $2
      LIMIT 1
      `, [tenantId, userId]);
        return result?.global_user_id || null;
    }
    /**
     * Cria um agendamento (schedule) a partir de um post
     * Cria ou busca schedule do cliente (quem criou o job)
     * Adiciona um slot reservado para o horário solicitado
     */
    async createScheduleFromPost(postId, tenantId, customerUserId, startTime, endTime) {
        // 1. Resolver job a partir do post
        const job = await this.resolveJobFromPost(postId, tenantId);
        if (!job) {
            throw new Error('Post does not have an associated job');
        }
        // 2. Resolver global_user_id do cliente (quem criou o job)
        const providerGlobalUserId = await this.resolveGlobalUserId(tenantId, job.clientUserId);
        if (!providerGlobalUserId) {
            throw new Error('Provider global user ID not found');
        }
        // 3. Criar ou buscar schedule do provider
        const schedule = await schedule_service_1.scheduleService.getOrCreateUserSchedule(tenantId, providerGlobalUserId);
        // 4. Resolver global_user_id do customer (quem está agendando)
        const customerGlobalUserId = await this.resolveGlobalUserId(tenantId, customerUserId);
        if (!customerGlobalUserId) {
            throw new Error('Customer global user ID not found');
        }
        // 5. Adicionar slot como disponível primeiro
        const slot = await schedule_service_1.scheduleService.addSlot(tenantId, schedule.scheduleId, {
            startTime,
            endTime,
            status: 'available',
            metadata: {
                source: 'social_post',
                postId,
                jobId: job.jobId,
                customerUserId,
                providerUserId: job.clientUserId,
            },
        });
        // 6. Reservar o slot imediatamente para o customer
        const reservedSlot = await schedule_service_1.scheduleService.reserveSlot(tenantId, schedule.scheduleId, {
            slotId: slot.slotId,
            metadata: {
                source: 'social_post',
                postId,
                jobId: job.jobId,
            },
        }, customerGlobalUserId);
        return reservedSlot;
    }
    /**
     * Lista agendamentos (slots reservados) vinculados ao job do post
     */
    async getSchedulesForPost(postId, tenantId) {
        // 1. Resolver job a partir do post
        const job = await this.resolveJobFromPost(postId, tenantId);
        if (!job) {
            return [];
        }
        // 2. Resolver global_user_id do provider
        const providerGlobalUserId = await this.resolveGlobalUserId(tenantId, job.clientUserId);
        if (!providerGlobalUserId) {
            return [];
        }
        // 3. Buscar schedule do provider
        const schedule = await schedule_service_1.scheduleService.getScheduleByUser(tenantId, providerGlobalUserId);
        if (!schedule) {
            return [];
        }
        // 4. Buscar slots do schedule que estão vinculados ao job
        const scheduleWithSlots = await schedule_service_1.scheduleService.getScheduleWithSlots(tenantId, schedule.scheduleId);
        if (!scheduleWithSlots || !scheduleWithSlots.slots) {
            return [];
        }
        // 5. Filtrar slots que têm jobId no metadata
        const jobSlots = scheduleWithSlots.slots.filter((slot) => {
            const metadata = slot.metadata || {};
            return metadata.jobId === job.jobId || metadata.postId === postId;
        });
        return jobSlots;
    }
}
exports.socialWorkScheduleService = new SocialWorkScheduleService();
//# sourceMappingURL=social-work-schedule.service.js.map