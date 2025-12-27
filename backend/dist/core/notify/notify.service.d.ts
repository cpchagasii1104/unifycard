import { EnqueueNotificationInput, Notification, NotificationChannel, NotificationStatus } from './notify.types';
export interface ProcessOptions {
    limit?: number;
}
export declare class NotifyService {
    private readonly templateProvider;
    private readonly emailProvider;
    private readonly smsProvider;
    private readonly pushProvider;
    private readonly webhookProvider;
    enqueue(input: EnqueueNotificationInput): Promise<Notification>;
    pushToUser(tenantId: string, userId: string, input: {
        title: string;
        body: string;
        data?: Record<string, unknown>;
    }, options?: {
        scheduledAt?: Date;
        maxRetries?: number;
    }): Promise<Notification>;
    emailToTarget(tenantId: string, targetEmail: string, input: {
        subject: string;
        body: string;
    }, options?: {
        scheduledAt?: Date;
        maxRetries?: number;
    }): Promise<Notification>;
    getById(tenantId: string, notificationId: string): Promise<Notification | null>;
    list(tenantId: string, status?: NotificationStatus, limit?: number, offset?: number): Promise<Notification[]>;
    processPendingForTenant(tenantId: string, options?: ProcessOptions): Promise<number>;
    /**
     * Compatibilidade com chamadas legadas que esperam um método genérico `send`.
     * Faz o dispatch para o canal correto montando a estrutura mínima necessária.
     */
    send(tenantId: string, input: {
        channel: NotificationChannel;
        to?: string;
        userId?: string | null;
        template?: string | null;
        data?: Record<string, unknown>;
    }): Promise<Notification>;
    send(input: {
        tenantId: string;
        channel: NotificationChannel;
        to?: string;
        userId?: string | null;
        template?: string | null;
        templateName?: string | null;
        target?: string;
        payload?: Record<string, unknown>;
        data?: Record<string, unknown>;
    }): Promise<Notification>;
    private dispatchNotification;
    retryNotification(tenantId: string, notificationId: string): Promise<Notification | null>;
}
export declare const notifyService: NotifyService;
//# sourceMappingURL=notify.service.d.ts.map