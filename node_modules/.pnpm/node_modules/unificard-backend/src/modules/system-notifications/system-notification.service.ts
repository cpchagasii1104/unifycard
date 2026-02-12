// backend/src/modules/system-notifications/system-notification.service.ts
// Service para Notificações In-App
// 🔴 BLINDAGEM: NÃO executa ações automaticamente
// 🔴 BLINDAGEM: NÃO marca como lida automaticamente

import { systemNotificationRepository } from './system-notification.repository';
import { NotFoundError, BadRequestError } from '@core/errors';
import type {
  SystemNotification,
  CreateSystemNotificationInput,
  SystemNotificationFilters,
} from './system-notification.types';

class SystemNotificationService {
  /**
   * Criar notificação
   */
  async createNotification(
    tenantId: string,
    input: CreateSystemNotificationInput
  ): Promise<SystemNotification> {
    // 0. Verificar rate limit (não bloqueante)
    try {
      const { businessRateLimitService } = await import('@core/rate-limiting/business-rate-limit.service');
      const rateLimit = await businessRateLimitService.checkRateLimit(
        tenantId,
        input.recipientActorId,
        'notification:create',
        input.contextId
      );
      if (!rateLimit.allowed) {
        // Para notificações, apenas logar (não bloquear)
        console.warn(`[SystemNotification] Rate limit excedido para ${input.recipientActorId}, mas permitindo (fail-open)`);
      }
    } catch (rateLimitError) {
      // Fail-open: não bloquear criação de notificação se rate limit falhar
      console.warn('[SystemNotification] Erro ao verificar rate limit (não bloqueante):', rateLimitError);
    }

    if (!input.message || input.message.trim().length === 0) {
      throw new BadRequestError('Mensagem da notificação não pode estar vazia');
    }

    return await systemNotificationRepository.create(tenantId, input);
  }

  /**
   * Buscar notificação por ID
   */
  async getNotificationById(
    tenantId: string,
    notificationId: string
  ): Promise<SystemNotification> {
    const notification = await systemNotificationRepository.findById(tenantId, notificationId);
    if (!notification) {
      throw new NotFoundError(`Notificação não encontrada: ${notificationId}`);
    }
    return notification;
  }

  /**
   * Listar notificações com filtros
   */
  async listNotifications(
    tenantId: string,
    filters: SystemNotificationFilters = {}
  ): Promise<{ notifications: SystemNotification[]; totalCents: number }> {
    return await systemNotificationRepository.find(tenantId, filters);
  }

  /**
   * Contar notificações não lidas
   */
  async countUnread(
    tenantId: string,
    recipientActorId: string
  ): Promise<number> {
    return await systemNotificationRepository.countUnread(tenantId, recipientActorId);
  }

  /**
   * Marcar notificação como lida
   */
  async markAsRead(
    tenantId: string,
    notificationId: string
  ): Promise<SystemNotification> {
    return await systemNotificationRepository.markAsRead(tenantId, notificationId);
  }

  /**
   * Marcar todas as notificações como lidas
   */
  async markAllAsRead(
    tenantId: string,
    recipientActorId: string
  ): Promise<{ count: number }> {
    const count = await systemNotificationRepository.markAllAsRead(tenantId, recipientActorId);
    return { count };
  }
}

export const systemNotificationService = new SystemNotificationService();


