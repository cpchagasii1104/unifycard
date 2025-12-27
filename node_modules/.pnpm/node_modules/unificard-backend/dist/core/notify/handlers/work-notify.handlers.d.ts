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
import type { EventBus } from '@core/events/event-bus';
export declare function registerWorkNotifyHandlers(eventBus: EventBus): void;
//# sourceMappingURL=work-notify.handlers.d.ts.map