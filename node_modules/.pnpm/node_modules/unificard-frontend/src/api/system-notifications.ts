// frontend/src/api/system-notifications.ts
// API Client para Notificações In-App

import { apiFetch } from './client';

export type SystemNotificationType =
  | 'rfq_created'
  | 'quote_received'
  | 'booking_requested'
  | 'booking_accepted'
  | 'booking_rejected'
  | 'message_received'
  | 'service_order_confirmed'
  | 'service_order_completed';

export type SystemNotificationContextType = 'event' | 'rfq' | 'booking' | 'service_order';

export interface SystemNotification {
  notificationId: string;
  tenantId: string;
  recipientActorId: string;
  type: SystemNotificationType;
  contextType: SystemNotificationContextType;
  contextId: string;
  message: string;
  metadata?: Record<string, any> | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * Listar notificações
 */
export async function listSystemNotifications(filters?: {
  recipientActorId?: string;
  type?: SystemNotificationType;
  contextType?: SystemNotificationContextType;
  contextId?: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ notifications: SystemNotification[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.recipientActorId) params.append('recipientActorId', filters.recipientActorId);
  if (filters?.type) params.append('type', filters.type);
  if (filters?.contextType) params.append('contextType', filters.contextType);
  if (filters?.contextId) params.append('contextId', filters.contextId);
  if (filters?.unreadOnly) params.append('unreadOnly', 'true');
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.offset) params.append('offset', filters.offset.toString());

  const response = await apiFetch(`/system-notifications?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao listar notificações' }));
    throw new Error(error.error || 'Erro ao listar notificações');
  }

  return response.json();
}

/**
 * Contar notificações não lidas
 */
export async function getUnreadNotificationCount(recipientActorId?: string): Promise<{ count: number }> {
  const params = new URLSearchParams();
  if (recipientActorId) params.append('recipientActorId', recipientActorId);

  const response = await apiFetch(`/system-notifications/unread-count?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao contar notificações não lidas' }));
    throw new Error(error.error || 'Erro ao contar notificações não lidas');
  }

  return response.json();
}

/**
 * Buscar notificação por ID
 */
export async function getSystemNotification(notificationId: string): Promise<SystemNotification> {
  const response = await apiFetch(`/system-notifications/${notificationId}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao buscar notificação' }));
    throw new Error(error.error || 'Erro ao buscar notificação');
  }

  return response.json();
}

/**
 * Marcar notificação como lida
 */
export async function markNotificationAsRead(notificationId: string): Promise<SystemNotification> {
  const response = await apiFetch(`/system-notifications/${notificationId}/read`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao marcar notificação como lida' }));
    throw new Error(error.error || 'Erro ao marcar notificação como lida');
  }

  return response.json();
}

/**
 * Marcar todas as notificações como lidas
 */
export async function markAllNotificationsAsRead(recipientActorId?: string): Promise<{ count: number }> {
  const response = await apiFetch('/system-notifications/mark-all-read', {
    method: 'POST',
    body: JSON.stringify({ recipientActorId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao marcar todas as notificações como lidas' }));
    throw new Error(error.error || 'Erro ao marcar todas as notificações como lidas');
  }

  return response.json();
}




