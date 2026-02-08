// backend/src/modules/system-notifications/system-notification.types.ts
// Tipos para Notificações In-App Explícitas
// 🔴 BLINDAGEM: NÃO executa ações automaticamente
// 🔴 BLINDAGEM: NÃO marca como lida automaticamente

/**
 * Tipo de notificação
 */
export type SystemNotificationType =
  | 'rfq_created'
  | 'quote_received'
  | 'booking_requested'
  | 'booking_accepted'
  | 'booking_rejected'
  | 'message_received'
  | 'service_order_confirmed'
  | 'service_order_completed';

/**
 * Tipo de contexto da notificação
 */
export type SystemNotificationContextType = 'event' | 'rfq' | 'booking' | 'service_order';

/**
 * Notificação in-app do sistema
 */
export interface SystemNotification {
  notificationId: string;
  tenantId: string;
  recipientActorId: string;
  type: SystemNotificationType;
  contextType: SystemNotificationContextType;
  contextId: string;
  message: string;
  metadata?: Record<string, any> | null;
  readAt: Date | null;
  createdAt: string;
}

/**
 * Input para criar notificação
 */
export interface CreateSystemNotificationInput {
  recipientActorId: string;
  type: SystemNotificationType;
  contextType: SystemNotificationContextType;
  contextId: string;
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Filtros para buscar notificações
 */
export interface SystemNotificationFilters {
  recipientActorId?: string;
  type?: SystemNotificationType;
  contextType?: SystemNotificationContextType;
  contextId?: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}





