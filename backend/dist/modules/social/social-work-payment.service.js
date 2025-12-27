"use strict";
// src/modules/social/social-work-payment.service.ts
//
// Serviço de integração entre Social, Work e Economy (Payment)
// Permite pagar serviços publicados em posts diretamente
Object.defineProperty(exports, "__esModule", { value: true });
exports.socialWorkPaymentService = void 0;
const social_work_service_1 = require("./social-work.service");
const schedule_service_1 = require("../schedule/schedule.service");
const transaction_service_1 = require("@core/economy/transactions/transaction.service");
const account_service_1 = require("@core/economy/accounts/account.service");
const pool_1 = require("@core/database/pool");
class SocialWorkPaymentService {
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
     * Resolve job e schedule reservado para o customer a partir de um post
     * Retorna jobId e scheduleId relacionados
     */
    async resolveScheduledJobFromPost(postId, tenantId, customerUserId) {
        // 1. Resolver job a partir do post
        const job = await social_work_service_1.socialWorkService.resolveJobFromPost(postId, tenantId);
        if (!job) {
            return null;
        }
        // 2. Resolver global_user_id do customer
        const customerGlobalUserId = await this.resolveGlobalUserId(tenantId, customerUserId);
        if (!customerGlobalUserId) {
            return null;
        }
        // 3. Resolver global_user_id do provider (quem criou o job)
        const providerGlobalUserId = await this.resolveGlobalUserId(tenantId, job.clientUserId);
        if (!providerGlobalUserId) {
            return null;
        }
        // 4. Buscar schedule do provider
        const schedule = await schedule_service_1.scheduleService.getScheduleByUser(tenantId, providerGlobalUserId);
        if (!schedule) {
            return null;
        }
        // 5. Buscar slots do schedule que estão reservados pelo customer e vinculados ao job
        const scheduleWithSlots = await schedule_service_1.scheduleService.getScheduleWithSlots(tenantId, schedule.scheduleId);
        if (!scheduleWithSlots || !scheduleWithSlots.slots) {
            return null;
        }
        // 6. Filtrar slots reservados pelo customer e vinculados ao job
        const customerSlots = scheduleWithSlots.slots.filter((slot) => {
            const metadata = slot.metadata || {};
            const isReservedByCustomer = slot.reservedByGlobalUserId === customerGlobalUserId;
            const isLinkedToJob = metadata.jobId === job.jobId || metadata.postId === postId;
            const isReserved = slot.status === 'reserved';
            return isReservedByCustomer && isLinkedToJob && isReserved;
        });
        if (customerSlots.length === 0) {
            return null;
        }
        // Retornar o primeiro slot encontrado (ou o mais recente)
        const slot = customerSlots[0];
        return {
            jobId: job.jobId,
            scheduleId: schedule.scheduleId,
            slotId: slot.slotId,
        };
    }
    /**
     * Cria pagamento a partir de um post
     * Cria transação via economyService
     */
    async createPaymentFromPost(postId, tenantId, customerUserId, amount) {
        // 1. Resolver job e schedule
        const scheduledJob = await this.resolveScheduledJobFromPost(postId, tenantId, customerUserId);
        if (!scheduledJob) {
            throw new Error('No scheduled service found for this post. Schedule a service first.');
        }
        // 2. Resolver job completo
        const job = await social_work_service_1.socialWorkService.resolveJobFromPost(postId, tenantId);
        if (!job) {
            throw new Error('Job not found');
        }
        // 3. Resolver global_user_ids
        const customerGlobalUserId = await this.resolveGlobalUserId(tenantId, customerUserId);
        const providerGlobalUserId = await this.resolveGlobalUserId(tenantId, job.clientUserId);
        if (!customerGlobalUserId || !providerGlobalUserId) {
            throw new Error('User IDs not found');
        }
        // 4. Buscar ou criar contas
        // Nota: getAccountsByGlobalUserId retorna Account[], mas precisamos usar ownerId (user_id local)
        // Vamos buscar contas por ownerId usando getAccountsByOwner
        const customerAccounts = await account_service_1.accountService.getAccountsByOwner(tenantId, customerUserId, 'user');
        const customerAccount = customerAccounts[0] || await account_service_1.accountService.createAccount(tenantId, {
            ownerId: customerUserId,
            ownerType: 'user',
            currency: 'BRL',
        });
        const providerAccounts = await account_service_1.accountService.getAccountsByOwner(tenantId, job.clientUserId, 'user');
        const providerAccount = providerAccounts[0] || await account_service_1.accountService.createAccount(tenantId, {
            ownerId: job.clientUserId,
            ownerType: 'user',
            currency: 'BRL',
        });
        // 5. Criar transação
        const transferResult = await transaction_service_1.transactionService.transfer(tenantId, {
            fromAccount: customerAccount.accountId,
            toAccount: providerAccount.accountId,
            amount,
            metadata: {
                postId,
                jobId: scheduledJob.jobId,
                scheduleId: scheduledJob.scheduleId,
                slotId: scheduledJob.slotId,
                source: 'social_post',
                customerUserId,
                providerUserId: job.clientUserId,
            },
        });
        return transferResult.transaction;
    }
}
exports.socialWorkPaymentService = new SocialWorkPaymentService();
//# sourceMappingURL=social-work-payment.service.js.map