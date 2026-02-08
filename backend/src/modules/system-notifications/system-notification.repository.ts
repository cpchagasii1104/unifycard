// backend/src/modules/system-notifications/system-notification.repository.ts
// Repository para Notificações In-App
// 🔴 BLINDAGEM: NÃO executa ações automaticamente

import { runQueryWithTenant } from '@core/database/pool';
import type {
  SystemNotification,
  CreateSystemNotificationInput,
  SystemNotificationFilters,
} from './system-notification.types';

interface SystemNotificationRow {
  notification_id: string;
  tenant_id: string;
  recipient_actor_id: string;
  type: string;
  context_type: string;
  context_id: string;
  message: string;
  metadata: any;
  readAt: Date | null;
  createdAt: Date;
}

class SystemNotificationRepository {
  private toNotification(row: SystemNotificationRow): SystemNotification {
    return {
      notificationId: row.notification_id,
      tenantId: row.tenant_id,
      recipientActorId: row.recipient_actor_id,
      type: row.type as any,
      contextType: row.context_type as any,
      contextId: row.context_id,
      message: row.message,
      metadata: row.metadata || {},
      readAt: row.readAt,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Criar notificação
   */
  async create(
    tenantId: string,
    input: CreateSystemNotificationInput
  ): Promise<SystemNotification> {
    const row = await runQueryWithTenant<SystemNotificationRow>(
      tenantId,
      `
      INSERT INTO system_notifications (
        tenant_id, recipient_actor_id, type, context_type, context_id, message, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING notification_id, tenant_id, recipient_actor_id, type, context_type, context_id,
                message, metadata, readAt, createdAt
      `,
      [
        tenantId,
        input.recipientActorId,
        input.type,
        input.contextType,
        input.contextId,
        input.message.trim(),
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Falha ao criar notificação');
    }

    return this.toNotification(row);
  }

  /**
   * Buscar notificação por ID
   */
  async findById(
    tenantId: string,
    notificationId: string
  ): Promise<SystemNotification | null> {
    const row = await runQueryWithTenant<SystemNotificationRow>(
      tenantId,
      `
      SELECT notification_id, tenant_id, recipient_actor_id, type, context_type, context_id,
             message, metadata, readAt, createdAt
      FROM system_notifications
      WHERE tenant_id = $1 AND notification_id = $2
      `,
      [tenantId, notificationId]
    );

    return row ? this.toNotification(row) : null;
  }

  /**
   * Listar notificações com filtros
   */
  async find(
    tenantId: string,
    filters: SystemNotificationFilters = {}
  ): Promise<{ notifications: SystemNotification[]; totalCents: number }> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.recipientActorId) {
      conditions.push(`recipient_actor_id = $${paramIndex++}`);
      params.push(filters.recipientActorId);
    }

    if (filters.type) {
      conditions.push(`type = $${paramIndex++}`);
      params.push(filters.type);
    }

    if (filters.contextType) {
      conditions.push(`context_type = $${paramIndex++}`);
      params.push(filters.contextType);
    }

    if (filters.contextId) {
      conditions.push(`context_id = $${paramIndex++}`);
      params.push(filters.contextId);
    }

    if (filters.unreadOnly) {
      conditions.push(`readAt IS NULL`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Contar total
    const countRow = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM system_notifications
      ${whereClause}
      `,
      params
    );

    const total = parseInt(countRow?.count || '0', 10);

    // Buscar notificações
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const rows = await runQueryWithTenant<SystemNotificationRow>(
      tenantId,
      `
      SELECT notification_id, tenant_id, recipient_actor_id, type, context_type, context_id,
             message, metadata, readAt, createdAt
      FROM system_notifications
      ${whereClause}
      ORDER BY createdAt DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `,
      [...params, limit, offset]
    );

    return {
      notifications: rows.map((row) => this.toNotification(row)),
      total,
    };
  }

  /**
   * Contar notificações não lidas
   */
  async countUnread(
    tenantId: string,
    recipientActorId: string
  ): Promise<number> {
    const row = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM system_notifications
      WHERE tenant_id = $1 AND recipient_actor_id = $2 AND readAt IS NULL
      `,
      [tenantId, recipientActorId]
    );

    return parseInt(row?.count || '0', 10);
  }

  /**
   * Marcar notificação como lida
   */
  async markAsRead(
    tenantId: string,
    notificationId: string
  ): Promise<SystemNotification> {
    const row = await runQueryWithTenant<SystemNotificationRow>(
      tenantId,
      `
      UPDATE system_notifications
      SET readAt = NOW()
      WHERE tenant_id = $1 AND notification_id = $2 AND readAt IS NULL
      RETURNING notification_id, tenant_id, recipient_actor_id, type, context_type, context_id,
                message, metadata, readAt, createdAt
      `,
      [tenantId, notificationId]
    );

    if (!row) {
      throw new Error('Notificação não encontrada ou já foi lida');
    }

    return this.toNotification(row);
  }

  /**
   * Marcar todas as notificações como lidas
   */
  async markAllAsRead(
    tenantId: string,
    recipientActorId: string
  ): Promise<number> {
    const row = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      UPDATE system_notifications
      SET readAt = NOW()
      WHERE tenant_id = $1 AND recipient_actor_id = $2 AND readAt IS NULL
      RETURNING COUNT(*) as count
      `,
      [tenantId, recipientActorId]
    );

    return parseInt(row?.count || '0', 10);
  }
}

export const systemNotificationRepository = new SystemNotificationRepository();







