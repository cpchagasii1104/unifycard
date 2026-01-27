// backend/src/modules/system-notifications/system-notification.helpers.ts
// Helpers para criar notificações de forma não bloqueante
// 🔴 BLINDAGEM: NÃO executa ações automaticamente

import { systemNotificationService } from './system-notification.service';
import type { SystemNotificationType, SystemNotificationContextType } from './system-notification.types';

/**
 * Criar notificação de forma não bloqueante
 * Se falhar, apenas loga o erro sem quebrar o fluxo principal
 */
export async function createNotificationSafely(
  tenantId: string,
  input: {
    recipientActorId: string;
    type: SystemNotificationType;
    contextType: SystemNotificationContextType;
    contextId: string;
    message: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  try {
    await systemNotificationService.createNotification(tenantId, input);
  } catch (error) {
    // Não bloquear fluxo principal se notificação falhar
    console.error('Erro ao criar notificação (não bloqueante):', error);
  }
}




