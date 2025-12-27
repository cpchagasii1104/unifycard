// backend/src/core/notify/handlers/work-notify.handlers.ts

/**
 * Handlers de notificação do módulo WORK.
 *
 * Eventos escutados:
 * - work.application.created
 * - work.assignment.created
 * - work.assignment.completed
 * - work.assignment.paid
 *
 * Todas as notificações vão para o NotifyService (push/email/in-app).
 */

import type { EventBus, UnificardEvent } from '@core/events/event-bus';
import { notifyService } from '@core/notify/notify.service';

export function registerWorkNotifyHandlers(eventBus: EventBus) {

  // ============================================================
  // 📩 1. Nova candidatura criada (worker → cliente)
  // ============================================================
  eventBus.registerHandler(
    'work.application.created',
    async (event: UnificardEvent) => {
      const { tenantId, payload } = event;
      if (!payload?.clientUserId) return;
      const clientUserId = String(payload.clientUserId);

      await notifyService.enqueue({
        tenantId,
        userId: clientUserId,
        channel: 'push',
        templateName: null,
        target: clientUserId,
        payload: {
          title: 'Nova candidatura recebida',
          body: 'Um worker se candidatou ao seu job.',
          jobId: payload.jobId,
          applicationId: payload.applicationId,
        },
      });
    }
  );

  // ============================================================
  // 📩 2. Assignment criado (cliente aceitou worker)
  // ============================================================
  eventBus.registerHandler(
    'work.assignment.created',
    async (event: UnificardEvent) => {
      const { tenantId, payload } = event;
      if (!payload?.workerId) return;
      const workerId = String(payload.workerId);

      await notifyService.enqueue({
        tenantId,
        userId: workerId,
        channel: 'push',
        templateName: null,
        target: workerId,
        payload: {
          title: 'Você foi selecionado!',
          body: 'Um cliente aceitou sua candidatura.',
          assignmentId: payload.assignmentId,
          jobId: payload.jobId,
        },
      });
    }
  );

  // ============================================================
  // 📩 3. Assignment completado (ambos devem avaliar)
  // ============================================================
  eventBus.registerHandler(
    'work.assignment.completed',
    async (event: UnificardEvent) => {
      const { tenantId, payload } = event;
      if (!payload?.assignmentId) return;

      // Worker → avaliar cliente
      if (payload.workerId) {
        const workerId = String(payload.workerId);
        await notifyService.enqueue({
          tenantId,
          userId: workerId,
          channel: 'push',
          templateName: null,
          target: workerId,
          payload: {
            title: 'Trabalho concluído!',
            body: 'O cliente marcou o job como concluído. Avalie o cliente.',
            assignmentId: payload.assignmentId,
          },
        });
      }

      // Cliente → avaliar worker
      if (payload.clientUserId) {
        const clientUserId = String(payload.clientUserId);
        await notifyService.enqueue({
          tenantId,
          userId: clientUserId,
          channel: 'push',
          templateName: null,
          target: clientUserId,
          payload: {
            title: 'Trabalho finalizado',
            body: 'Você marcou o job como concluído. Avalie o worker.',
            assignmentId: payload.assignmentId,
          },
        });
      }
    }
  );

  // ============================================================
  // 📩 4. Pagamento concluído — worker recebe confirmação
  // ============================================================
  eventBus.registerHandler(
    'work.assignment.paid',
    async (event: UnificardEvent) => {
      const { tenantId, payload } = event;
      if (!payload?.workerId) return;
      const workerId = String(payload.workerId);

      await notifyService.enqueue({
        tenantId,
        userId: workerId,
        channel: 'push',
        templateName: null,
        target: workerId,
        payload: {
          title: 'Pagamento recebido',
          body: `Você recebeu R$ ${payload.amount} pelo trabalho.`,
          assignmentId: payload.assignmentId,
          transactionId: payload.paymentTransactionId,
        },
      });
    }
  );
}
