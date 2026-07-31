// backend/src/modules/subscriptions/subscription.service.ts
// SPRINT 87: ASSINATURAS (RECORRÊNCIA AUDITÁVEL)

import { subscriptionRepository } from './subscription.repository';
import { contactService } from '../marketplace/contact.service';
import { paymentLinkService } from '../payments/payment-link.service';
import { scheduledActionService } from '../automation/scheduled-action.service';
import type {
  Subscription,
  CreateSubscriptionInput,
  SubscriptionFilters,
} from './subscription.types';

/**
 * Service para Assinaturas
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - READ/WRITE apenas em entidades de assinatura
 * - Não altera PaymentLink ou PaymentIntent diretamente
 * - Usa ScheduledActions para execução (tudo explícito e auditável)
 * - PIX só fecha ciclo após webhook SUCCESS
 * - Tudo auditável
 */
class SubscriptionService {
  /**
   * Cria assinatura
   */
  async createSubscription(
    tenantId: string,
    createdByActorId: string,
    createdByUserId: string | null,
    input: CreateSubscriptionInput
  ): Promise<Subscription> {
    // 1. Validar contact existe
    const contact = await contactService.getContactById(tenantId, input.contactId);
    if (!contact) {
      throw new Error(`Contato não encontrado: ${input.contactId}`);
    }

    // 2. Validar payment_link existe
    const paymentLink = await paymentLinkService.getById(tenantId, input.paymentLinkId);
    if (!paymentLink) {
      throw new Error(`Payment link não encontrado: ${input.paymentLinkId}`);
    }

    // 3. Validar day_of_month se MONTHLY
    if (input.interval === 'MONTHLY' && input.dayOfMonth !== undefined && input.dayOfMonth !== null) {
      if (input.dayOfMonth < 1 || input.dayOfMonth > 28) {
        throw new Error('day_of_month deve estar entre 1 e 28');
      }
    }

    // 4. Definir next_runAt (default: agora + 5min)
    const nextRunAt = input.nextRunAt || new Date(Date.now() + 5 * 60 * 1000);

    // 5. Criar assinatura
    const subscription = await subscriptionRepository.createSubscription(
      tenantId,
      createdByActorId,
      createdByUserId,
      {
        ...input,
        nextRunAt,
      }
    );

    // 6. Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'SUBSCRIPTION_CREATED',
      subscriptionId: subscription.id,
      contactId: input.contactId,
      paymentLinkId: input.paymentLinkId,
      amountCents: input.amountCents,
      interval: input.interval,
      createdByActorId,
      createdByUserId,
    });

    return subscription;
  }

  /**
   * Pausa assinatura
   */
  async pauseSubscription(
    tenantId: string,
    subscriptionId: string,
    actorId: string,
    userId: string | null
  ): Promise<Subscription> {
    const subscription = await subscriptionRepository.getSubscriptionById(tenantId, subscriptionId);
    if (!subscription) {
      throw new Error(`Assinatura não encontrada: ${subscriptionId}`);
    }

    if (subscription.status !== 'ACTIVE') {
      throw new Error(`Assinatura não está ativa (status: ${subscription.status})`);
    }

    await subscriptionRepository.updateStatus(tenantId, subscriptionId, 'PAUSED');

    await this.recordAudit(tenantId, {
      eventType: 'SUBSCRIPTION_PAUSED',
      subscriptionId,
      actorId,
      userId,
    });

    return (await subscriptionRepository.getSubscriptionById(tenantId, subscriptionId))!;
  }

  /**
   * Retoma assinatura
   */
  async resumeSubscription(
    tenantId: string,
    subscriptionId: string,
    actorId: string,
    userId: string | null
  ): Promise<Subscription> {
    const subscription = await subscriptionRepository.getSubscriptionById(tenantId, subscriptionId);
    if (!subscription) {
      throw new Error(`Assinatura não encontrada: ${subscriptionId}`);
    }

    if (subscription.status !== 'PAUSED') {
      throw new Error(`Assinatura não está pausada (status: ${subscription.status})`);
    }

    // Recalcular next_runAt se estiver no passado
    let nextRunAt = subscription.nextRunAt;
    if (nextRunAt < new Date()) {
      nextRunAt = new Date(Date.now() + 5 * 60 * 1000); // Agora + 5min
      await subscriptionRepository.updateNextRunAt(tenantId, subscriptionId, nextRunAt);
    }

    await subscriptionRepository.updateStatus(tenantId, subscriptionId, 'ACTIVE');

    await this.recordAudit(tenantId, {
      eventType: 'SUBSCRIPTION_RESUMED',
      subscriptionId,
      nextRunAt: nextRunAt.toISOString(),
      actorId,
      userId,
    });

    return (await subscriptionRepository.getSubscriptionById(tenantId, subscriptionId))!;
  }

  /**
   * Cancela assinatura
   */
  async cancelSubscription(
    tenantId: string,
    subscriptionId: string,
    actorId: string,
    userId: string | null
  ): Promise<Subscription> {
    const subscription = await subscriptionRepository.getSubscriptionById(tenantId, subscriptionId);
    if (!subscription) {
      throw new Error(`Assinatura não encontrada: ${subscriptionId}`);
    }

    await subscriptionRepository.updateStatus(tenantId, subscriptionId, 'CANCELLED');

    await this.recordAudit(tenantId, {
      eventType: 'SUBSCRIPTION_CANCELLED',
      subscriptionId,
      actorId,
      userId,
    });

    return (await subscriptionRepository.getSubscriptionById(tenantId, subscriptionId))!;
  }

  /**
   * Lista assinaturas
   */
  async listSubscriptions(tenantId: string, filters: SubscriptionFilters = {}): Promise<Subscription[]> {
    return await subscriptionRepository.listSubscriptions(tenantId, filters);
  }

  /**
   * Busca assinatura por ID
   */
  async getSubscriptionById(tenantId: string, subscriptionId: string): Promise<Subscription | null> {
    return await subscriptionRepository.getSubscriptionById(tenantId, subscriptionId);
  }

  /**
   * Agenda execuções de assinaturas vencidas
   * 
   * NÃO executa PaymentExecution diretamente.
   * Apenas cria ScheduledActions - tudo explícito e auditável.
   */
  async runDueSubscriptions(tenantId: string, limit: number = 50): Promise<{
    scheduled: number;
    results: Array<{ subscriptionId: string; success: boolean; error?: string }>;
  }> {
    const dueSubscriptions = await subscriptionRepository.getDueSubscriptions(tenantId, limit);

    const results: Array<{ subscriptionId: string; success: boolean; error?: string }> = [];
    let scheduled = 0;

    for (const subscription of dueSubscriptions) {
      try {
        // Criar ScheduledAction
        await this.createRunAction(tenantId, subscription);

        // Marcar last_runAt
        await subscriptionRepository.markLastRun(tenantId, subscription.id, null);

        scheduled++;
        results.push({ subscriptionId: subscription.id, success: true });

        // Registrar auditoria
        await this.recordAudit(tenantId, {
          eventType: 'SUBSCRIPTION_RUN_SCHEDULED',
          subscriptionId: subscription.id,
          nextRunAt: subscription.nextRunAt.toISOString(),
        });
      } catch (error: any) {
        const errorMessage = error.message || 'Erro desconhecido';
        results.push({ subscriptionId: subscription.id, success: false, error: errorMessage });
        console.error(`[SubscriptionService] Erro ao agendar execução de ${subscription.id}:`, error);
      }
    }

    return { scheduled, results };
  }

  /**
   * Cria ScheduledAction para execução de assinatura
   */
  private async createRunAction(tenantId: string, subscription: Subscription): Promise<void> {
    const paymentLink = await paymentLinkService.getById(tenantId, subscription.paymentLinkId);
    if (!paymentLink) {
      throw new Error(`Payment link não encontrado: ${subscription.paymentLinkId}`);
    }

    // Criar ScheduledAction imediata (ou no futuro próximo)
    const scheduledFor = new Date(); // Imediato

    await scheduledActionService.scheduleAction(
      tenantId,
      {
        actionType: 'PAYMENT_EXECUTION',
        referenceType: 'subscription',
        referenceId: subscription.id,
        scheduledFor,
        metadata: {
          subscription_id: subscription.id,
          payment_link_id: subscription.paymentLinkId,
          contact_id: subscription.contactId,
          amountCents: subscription.amountCents,
          currency: subscription.currency,
          source: 'SUBSCRIPTION',
        },
      },
      subscription.createdByActorId,
      subscription.createdByUserId ?? undefined
    );
  }

  /**
   * Executa assinatura (chamado pelo ScheduledActionService)
   * 
   * Este método será chamado quando ScheduledActionService.executeSingleAction()
   * detectar referenceType === 'subscription'
   */
  async executeSubscriptionAction(
    tenantId: string,
    subscriptionId: string,
    idempotencyKey?: string
  ): Promise<{ paymentIntentId: string; status: 'PENDING' | 'SUCCESS' }> {
    // 1. Revalidar subscription ACTIVE e next_runAt vencido
    const subscription = await subscriptionRepository.getSubscriptionById(tenantId, subscriptionId);
    if (!subscription) {
      throw new Error(`Assinatura não encontrada: ${subscriptionId}`);
    }

    if (subscription.status !== 'ACTIVE') {
      throw new Error(`Assinatura não está ativa (status: ${subscription.status})`);
    }

    if (subscription.nextRunAt > new Date()) {
      throw new Error(`Assinatura ainda não está vencida (next_runAt: ${subscription.nextRunAt})`);
    }

    // 2. Buscar payment link
    const paymentLink = await paymentLinkService.getById(tenantId, subscription.paymentLinkId);
    if (!paymentLink) {
      throw new Error(`Payment link não encontrado: ${subscription.paymentLinkId}`);
    }

    // 3. Criar PaymentIntent via endpoint interno do Payment Link
    const { paymentIntentService } = await import('../marketplace/payment-intent.service');
    const { orderService } = await import('../marketplace/order.service');

    // Criar order temporário (como no payment-link.routes.ts)
    const tempOrder = await orderService.createOrder(tenantId, {
      buyerActorId: paymentLink.createdByActorId, // Assumindo que seller é o criador do link
      sellerActorId: paymentLink.createdByActorId,
      metadata: {
        is_payment_link: true,
        payment_link_id: paymentLink.id,
        contact_id: subscription.contactId,
        source: 'SUBSCRIPTION',
        subscription_id: subscriptionId,
      },
    });

    // Submeter order (necessário para criar PaymentIntent)
    const submittedOrder = await orderService.submitOrder(tenantId, tempOrder.id);

    // Criar PaymentIntent
    const { createPaymentIntent } = await import('@modules/payments/payment-intent-repository');
    const intent = await createPaymentIntent(tenantId, {
      referenceId: submittedOrder.id,
      gateway: 'internal',
      actorId: paymentLink.createdByActorId,
      amountCents: subscription.amountCents,
      currency: subscription.currency,
      source: 'subscription',
      metadata: {
        payment_link_id: paymentLink.id,
        subscription_id: subscriptionId,
        contact_id: subscription.contactId,
        payerContactId: subscription.contactId,
        order_id: submittedOrder.id,
      },
    });

    // Autorizar PaymentIntent
    const authorizedIntent = await paymentIntentService.authorizePaymentIntent(tenantId, intent.id);

    // 4. Executar pagamento via PaymentExecution
    const { paymentExecutionService } = await import('../marketplace/payment-execution.service');

    // Buscar buyer/seller do payment link
    const buyerActorId = paymentLink.createdByActorId; // Por enquanto, assumir que contact é buyer
    const sellerActorId = paymentLink.createdByActorId;

    try {
      const transaction = await paymentExecutionService.executePayment(tenantId, {
        paymentIntentId: authorizedIntent.id,
        buyerActorId,
        sellerActorId,
        idempotencyKey,
      });

      // 5. Verificar método de pagamento
      // Se PIX: retornar PENDING e salvar last_payment_intent_id
      // Se UNIFYCARD: se SUCCESS imediato, fazer advanceCycleSuccess
      if (transaction.paymentMethod === 'PIX') {
        // PIX: aguardar webhook
        await subscriptionRepository.markLastRun(tenantId, subscriptionId, authorizedIntent.id);
        return { paymentIntentId: authorizedIntent.id, status: 'PENDING' };
      } else {
        // UNIFYCARD: verificar se SUCCESS imediato
        if (transaction.status === 'SUCCESS') {
          await this.advanceCycleSuccess(tenantId, subscriptionId);
          return { paymentIntentId: authorizedIntent.id, status: 'SUCCESS' };
        } else {
          // PENDING ou FAILED
          await subscriptionRepository.markLastRun(tenantId, subscriptionId, authorizedIntent.id);
          return { paymentIntentId: authorizedIntent.id, status: 'PENDING' };
        }
      }
    } catch (error: any) {
      // Falha na execução
      await this.advanceCycleFailure(tenantId, subscriptionId, {
        code: error.code || 'EXECUTION_ERROR',
        message: error.message || 'Erro desconhecido na execução',
      });
      throw error;
    }
  }

  /**
   * Avança ciclo após sucesso
   */
  async advanceCycleSuccess(tenantId: string, subscriptionId: string): Promise<void> {
    const subscription = await subscriptionRepository.getSubscriptionById(tenantId, subscriptionId);
    if (!subscription) {
      throw new Error(`Assinatura não encontrada: ${subscriptionId}`);
    }

    // Marcar sucesso
    await subscriptionRepository.markSuccess(tenantId, subscriptionId);

    // Recalcular next_runAt
    const nextRunAt = this.calculateNextRunAt(subscription);
    await subscriptionRepository.updateNextRunAt(tenantId, subscriptionId, nextRunAt);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'SUBSCRIPTION_CYCLE_SUCCESS',
      subscriptionId,
      nextRunAt: nextRunAt.toISOString(),
    });
  }

  /**
   * Avança ciclo após falha
   */
  async advanceCycleFailure(
    tenantId: string,
    subscriptionId: string,
    error: { code: string; message: string }
  ): Promise<void> {
    const subscription = await subscriptionRepository.getSubscriptionById(tenantId, subscriptionId);
    if (!subscription) {
      throw new Error(`Assinatura não encontrada: ${subscriptionId}`);
    }

    // Marcar falha
    await subscriptionRepository.markFailure(tenantId, subscriptionId, error.code, error.message);

    // Verificar se atingiu max_failures
    const paused = await subscriptionRepository.pauseIfMaxFailures(tenantId, subscriptionId);

    // Calcular backoff: 6h * failure_count
    const backoffHours = 6 * (subscription.failureCount + 1);
    const nextRunAt = new Date(Date.now() + backoffHours * 60 * 60 * 1000);
    await subscriptionRepository.updateNextRunAt(tenantId, subscriptionId, nextRunAt);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'SUBSCRIPTION_CYCLE_FAILED',
      subscriptionId,
      errorCode: error.code,
      errorMessage: error.message,
      failureCount: subscription.failureCount + 1,
      paused,
      nextRunAt: nextRunAt.toISOString(),
    });

    // Criar alerta se pausou
    if (paused) {
      const { alertService } = await import('../automation/alert.service');
      await alertService.createAlert(tenantId, {
        type: 'PAYMENT_FAILED',
        severity: 'ERROR',
        message: `Assinatura ${subscriptionId} foi pausada após ${subscription.maxFailures} falhas`,
        entityType: 'subscription',
        entityId: subscriptionId,
        metadata: {
          subscription_id: subscriptionId,
          failure_count: subscription.failureCount + 1,
          last_error: error.message,
        },
      });
    }
  }

  /**
   * Calcula próxima data de execução
   */
  private calculateNextRunAt(subscription: Subscription): Date {
    const now = new Date();
    let nextRunAt: Date;

    switch (subscription.interval) {
      case 'WEEKLY':
        nextRunAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 * subscription.intervalCount);
        break;
      case 'MONTHLY':
        // Usar day_of_month se fornecido
        if (subscription.dayOfMonth) {
          const nextMonth = new Date(now);
          nextMonth.setMonth(nextMonth.getMonth() + subscription.intervalCount);
          // Garantir que day_of_month não excede dias do mês
          const daysInMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
          const dayToSet = Math.min(subscription.dayOfMonth, daysInMonth);
          nextMonth.setDate(dayToSet);
          nextRunAt = nextMonth;
        } else {
          nextRunAt = new Date(now);
          nextRunAt.setMonth(nextRunAt.getMonth() + subscription.intervalCount);
        }
        break;
      case 'YEARLY':
        nextRunAt = new Date(now);
        nextRunAt.setFullYear(nextRunAt.getFullYear() + subscription.intervalCount);
        break;
      default:
        throw new Error(`Intervalo não suportado: ${subscription.interval}`);
    }

    return nextRunAt;
  }

  /**
   * Registra auditoria
   */
  private async recordAudit(tenantId: string, data: Record<string, any>): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: (data.eventType as string) ?? 'SUBSCRIPTION_EVENT',
        severity: 'WARNING',
        source: 'automation',
        context: data,
      });
    } catch (error) {
      // Não bloquear se auditoria falhar
      console.warn('[SubscriptionService] Erro ao registrar auditoria:', error);
    }
  }
}

export const subscriptionService = new SubscriptionService();



