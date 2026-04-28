// src/modules/social/social-work-payment.service.ts
//
// Serviço de integração entre Social, Work e Economy (Payment)
// Permite pagar serviços publicados em posts diretamente

import { socialWorkService } from './social-work.service';
// REMOVIDO: schedule.service foi removido (consolidado em Unified Availability)
// import { scheduleService } from '../schedule/schedule.service';
import { transactionService } from '@core/economy/transaction.service';
import { accountService } from '@core/economy/account.service';
import { runQueryWithTenant } from '@core/database/pool';
import { ensureUserActor } from '@modules/identity/actor-writer.service';
import { requireFinancialRiskClearance } from '@modules/risk-identity/risk-financial-gate';
import type { Job } from '../work/work.types';
import type { ScheduleSlot } from '../schedule/schedule.types';
import type { Transaction } from '@core/economy/transactions/transaction.types';

class SocialWorkPaymentService {
  /**
   * Resolve global_user_id a partir de user_id
   */
  private async resolveGlobalUserId(
    tenantId: string,
    userId: string
  ): Promise<string | null> {
    const result = await runQueryWithTenant<{ global_user_id: string }>(tenantId, {
      text: `
      SELECT global_user_id
      FROM users
      WHERE tenant_id = $1 AND user_id = $2
      LIMIT 1
      `,
      values: [tenantId, userId],
    });

    return result?.global_user_id || null;
  }

  /**
   * Resolve job e schedule reservado para o customer a partir de um post
   * Retorna jobId e scheduleId relacionados
   */
  async resolveScheduledJobFromPost(
    postId: string,
    tenantId: string,
    customerUserId: string
  ): Promise<{ jobId: string; scheduleId: string; slotId: string } | null> {
    // 1. Resolver job a partir do post
    const job = await socialWorkService.resolveJobFromPost(postId, tenantId);
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

    // REMOVIDO: schedule.service foi removido (consolidado em Unified Availability)
    // TODO: Migrar para unifiedAvailabilityService quando necessário
    // Funcionalidade temporariamente desabilitada
    return null;
    
    /* CÓDIGO REMOVIDO:
    // 4. Buscar schedule do provider
    const schedule = await scheduleService.getScheduleByUser(tenantId, providerGlobalUserId);
    if (!schedule) {
      return null;
    }

    // 5. Buscar slots do schedule que estão reservados pelo customer e vinculados ao job
    const scheduleWithSlots = await scheduleService.getScheduleWithSlots(tenantId, schedule.scheduleId);
    if (!scheduleWithSlots || !scheduleWithSlots.slots) {
      return null;
    }

    // 6. Filtrar slots reservados pelo customer e vinculados ao job
    const customerSlots = scheduleWithSlots.slots.filter((slot: ScheduleSlot) => {
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
    */
  }

  /**
   * Cria pagamento a partir de um post
   * Cria transação via economyService
   */
  async createPaymentFromPost(
    postId: string,
    tenantId: string,
    customerUserId: string,
    amountCents: number
  ): Promise<Transaction> {
    // 1. Resolver job e schedule
    const scheduledJob = await this.resolveScheduledJobFromPost(postId, tenantId, customerUserId);
    if (!scheduledJob) {
      throw new Error('No scheduled service found for this post. Schedule a service first.');
    }

    // 2. Resolver job completo
    const job = await socialWorkService.resolveJobFromPost(postId, tenantId);
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
    const customerAccounts = await accountService.getAccountsByOwner(tenantId, customerUserId, 'user');
    const customerAccount = customerAccounts[0] || await accountService.createAccount(tenantId, {
      ownerId: customerUserId,
      ownerType: 'user',
      currency: 'BRL',
    });

    const providerAccounts = await accountService.getAccountsByOwner(tenantId, job.clientUserId, 'user');
    const providerAccount = providerAccounts[0] || await accountService.createAccount(tenantId, {
      ownerId: job.clientUserId,
      ownerType: 'user',
      currency: 'BRL',
    });

    // AUTORIDADE: ensureUserActor → gate → transfer (INV-ID + INV-FIN)
    const customerActor = await ensureUserActor(tenantId, customerUserId);
    if (!customerActor?.id) {
      throw Object.assign(new Error('ACTOR_ID_NOT_RESOLVED'), { statusCode: 400 });
    }
    await requireFinancialRiskClearance(tenantId, {
      actorId: customerActor.id,
      action: 'financial_transfer',
      amountCents,
    });

    // 5. Criar transação
    const transferResult = await transactionService.transfer(tenantId, {
      fromAccount: customerAccount.accountId,
      toAccount: providerAccount.accountId,
      amountCents,
      referenceType: 'social_post_payment',
      referenceId: postId,
      metadata: {
        postId,
        jobId: scheduledJob.jobId,
        scheduleId: scheduledJob.scheduleId,
        slotId: scheduledJob.slotId,
        source: 'social_post',
        customerUserId,
        providerUserId: job.clientUserId,
      },
      concept_id: 'service-booking-payment',
    });

    const bankTx = await transactionService.getTransactionById(tenantId, transferResult.transactionId);
    if (!bankTx) {
      throw new Error('Transaction created but could not be retrieved');
    }
    return {
      transactionId: bankTx.transactionId,
      tenantId: bankTx.tenantId,
      fromAccount: bankTx.fromAccountId ?? '',
      toAccount: bankTx.toAccountId ?? '',
      amountCents: bankTx.amountCents,
      eventId: bankTx.eventId,
      status: bankTx.status === 'completed' ? 'completed' : (bankTx.status === 'pending' ? 'pending' : 'failed'),
      metadata: bankTx.metadata ?? {},
      createdAt: bankTx.createdAt,
    };
  }
}

export const socialWorkPaymentService = new SocialWorkPaymentService();


