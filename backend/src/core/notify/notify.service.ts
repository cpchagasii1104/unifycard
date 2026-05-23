// backend/src/core/notify/notify.service.ts

import {
  runQueryWithTenant,
  runQueriesWithTenant,
  getClientWithTenant,
} from '@core/database/pool';
import {
  EnqueueNotificationInput,
  Notification,
  NotificationChannel,
  NotificationPayload,
  NotificationQueueRow,
  NotificationStatus,
  ProviderResult,
} from './notify.types';

import { TemplateProvider } from './providers/templates.provider';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';
import { PushProvider } from './providers/push.provider';
import { WebhookProvider } from './providers/webhook.provider';

// ============================================================
// 🔧 MAP ROW → Domain Model
// ============================================================
function mapNotificationRow(row: NotificationQueueRow): Notification {
  return {
    notificationId: row.notification_id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    channel: row.channel as NotificationChannel,
    templateName: row.template_name,
    target: row.target,
    payload: (row.payload as NotificationPayload) ?? {},
    status: row.status as NotificationStatus,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ProcessOptions {
  limit?: number;
}

export class NotifyService {
  private readonly templateProvider = new TemplateProvider();
  private readonly emailProvider = new EmailProvider({
    fromAddress: process.env.NOTIFY_EMAIL_FROM || 'no-reply@unify.local',
  });

  private readonly smsProvider = new SmsProvider({
    fromNumber: process.env.NOTIFY_SMS_FROM,
  });

  private readonly pushProvider = new PushProvider({});
  private readonly webhookProvider = new WebhookProvider();

  // ============================================================
  // 🔥 ENQUEUE GENÉRICO
  // ============================================================
  async enqueue(input: EnqueueNotificationInput): Promise<Notification> {
    const {
      tenantId,
      userId = null,
      channel,
      templateName = null,
      target,
      payload,
      scheduledAt,
      maxRetries,
    } = input;

    const row = await runQueryWithTenant<NotificationQueueRow>(
      tenantId,
      `
      INSERT INTO notify_queue (
        tenant_id,
        user_id,
        channel,
        template_name,
        target,
        payload,
        status,
        retry_count,
        max_retries,
        scheduled_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'pending', 0, COALESCE($7, 5), COALESCE($8, now()))
      RETURNING *
      `,
      [
        tenantId,
        userId,
        channel,
        templateName,
        target,
        JSON.stringify(payload ?? {}),
        maxRetries ?? null,
        scheduledAt ?? null,
      ]
    );

    if (!row) {
      throw new Error('Failed to enqueue notification');
    }

    return mapNotificationRow(row);
  }

  // ============================================================
  // ⭐ HELPERS DE ALTO NÍVEL — usados pelos handlers
  // ============================================================

  async pushToUser(
    tenantId: string,
    userId: string,
    input: {
      title: string;
      body: string;
      data?: Record<string, unknown>;
    },
    options?: {
      scheduledAt?: Date;
      maxRetries?: number;
    }
  ): Promise<Notification> {
    return this.enqueue({
      tenantId,
      userId,
      channel: 'push',
      templateName: null,
      target: userId, // hoje userId = push target
      payload: {
        title: input.title,
        message: input.body,   // 🚀 CORRIGIDO: antes era "body"
        data: input.data ?? {},
      },
      scheduledAt: options?.scheduledAt,
      maxRetries: options?.maxRetries,
    });
  }

  async emailToTarget(
    tenantId: string,
    targetEmail: string,
    input: {
      subject: string;
      body: string;
    },
    options?: {
      scheduledAt?: Date;
      maxRetries?: number;
    }
  ): Promise<Notification> {
    return this.enqueue({
      tenantId,
      userId: null,
      channel: 'email',
      templateName: null,
      target: targetEmail,
      payload: {
        subject: input.subject,
        message: input.body, // normalizado
      },
      scheduledAt: options?.scheduledAt,
      maxRetries: options?.maxRetries,
    });
  }

  // ============================================================
  // GET BY ID
  // ============================================================
  async getById(
    tenantId: string,
    notificationId: string
  ): Promise<Notification | null> {
    const row = await runQueryWithTenant<NotificationQueueRow>(
      tenantId,
      `
      SELECT *
      FROM notify_queue
      WHERE notification_id = $1
      LIMIT 1
      `,
      [notificationId]
    );

    return row ? mapNotificationRow(row) : null;
  }

  // ============================================================
  // LIST
  // ============================================================
  async list(
    tenantId: string,
    status?: NotificationStatus,
    limit = 50,
    offset = 0
  ): Promise<Notification[]> {
    let query = `
      SELECT *
      FROM notify_queue
    `;
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const rows = await runQueriesWithTenant<NotificationQueueRow>(
      tenantId,
      query,
      params
    );

    return rows.map(mapNotificationRow);
  }

  // ============================================================
  // PROCESSA PENDENTES
  // ============================================================
  async processPendingForTenant(
    tenantId: string,
    options: ProcessOptions = {}
  ): Promise<number> {
    const limit = options.limit ?? 50;
    const client = await getClientWithTenant(tenantId);

    try {
      await client.query('BEGIN');

      const pendingResult = await client.query<NotificationQueueRow>(
        `
        SELECT *
        FROM notify_queue
        WHERE status = 'pending'
          AND scheduled_at <= now()
        ORDER BY scheduled_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $1
        `,
        [limit]
      );

      const notifications = pendingResult.rows;

      if (notifications.length === 0) {
        await client.query('COMMIT');
        return 0;
      }

      await client.query(
        `
        UPDATE notify_queue
        SET status = 'processing'
        WHERE notification_id = ANY($1::uuid[])
        `,
        [notifications.map(n => n.notification_id)]
      );

      await client.query('COMMIT');

      // processa 1 por 1 fora da transação
      let processed = 0;

      for (const row of notifications) {
        const notif = mapNotificationRow(row);
        const result = await this.dispatchNotification(notif);

        if (result.success) {
          await runQueryWithTenant<void>(
            tenantId,
            `
            UPDATE notify_queue
            SET status = 'sent',
                sent_at = now(),
                last_error = NULL
            WHERE notification_id = $1
            `,
            [notif.notificationId]
          );
        } else {
          const retry = notif.retryCount + 1;
          const fail = retry >= notif.maxRetries;

          await runQueryWithTenant<void>(
            tenantId,
            `
            UPDATE notify_queue
            SET status = $2,
                retry_count = $3,
                last_error = $4
            WHERE notification_id = $1
            `,
            [
              notif.notificationId,
              fail ? 'failed' : 'pending',
              retry,
              result.error ?? 'Unknown error',
            ]
          );
        }

        processed++;
      }

      return processed;
    } catch (error) {
      console.error('[NotifyService] Error processing notifications', {
        tenantId,
        error,
      });

      try {
        await client.query('ROLLBACK');
      } catch {}

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Compatibilidade com chamadas legadas que esperam um método genérico `send`.
   * Faz o dispatch para o canal correto montando a estrutura mínima necessária.
   */
  async send(
    tenantId: string,
    input: {
      channel: NotificationChannel;
      to?: string;
      userId?: string | null;
      template?: string | null;
      data?: Record<string, unknown>;
    }
  ): Promise<Notification>;

  async send(
    input: {
      tenantId: string;
      channel: NotificationChannel;
      to?: string;
      userId?: string | null;
      template?: string | null;
      templateName?: string | null;
      target?: string;
      payload?: Record<string, unknown>;
      data?: Record<string, unknown>;
    }
  ): Promise<Notification>;

  async send(
    tenantIdOrInput:
      | string
      | {
          tenantId: string;
          channel?: NotificationChannel;
          to?: string;
          userId?: string | null;
          template?: string | null;
          templateName?: string | null;
          target?: string;
          payload?: Record<string, unknown>;
          data?: Record<string, unknown>;
        },
    maybeInput?: {
      channel: NotificationChannel;
      to?: string;
      userId?: string | null;
      template?: string | null;
      data?: Record<string, unknown>;
    }
  ): Promise<Notification> {
    const normalized = (
      typeof tenantIdOrInput === 'string'
        ? { tenantId: tenantIdOrInput, ...(maybeInput ?? {}) }
        : tenantIdOrInput
    ) as {
      tenantId: string;
      channel?: NotificationChannel;
      to?: string;
      userId?: string | null;
      template?: string | null;
      templateName?: string | null;
      target?: string;
      payload?: Record<string, unknown>;
      data?: Record<string, unknown>;
    };

    if (!normalized.channel) {
      throw new Error('channel is required to send notification');
    }

    const {
      tenantId,
      channel,
      to,
      userId = null,
      template,
      templateName,
      target,
      payload,
      data,
    } = normalized;

    return this.enqueue({
      tenantId,
      userId,
      channel,
      templateName: template ?? templateName ?? null,
      target: target ?? to ?? userId ?? '',
      payload: payload ?? data ?? {},
    });
  }

  // ============================================================
  // PROVIDER DISPATCH
  // ============================================================
  private async dispatchNotification(
    notification: Notification
  ): Promise<ProviderResult> {
    const { tenantId, channel, templateName, payload, target } = notification;

    let subject = payload.subject as string | undefined;
    let body = (payload.message || payload.body || payload.text || '') as string;

    // Templates
    if (templateName) {
      const template = await this.templateProvider.getTemplate(
        tenantId,
        channel,
        templateName
      );

      if (!template) {
        return { success: false, error: 'Template not found' };
      }

      const rendered = this.templateProvider.renderTemplate(template, {
        tenantId,
        channel,
        templateName,
        payload,
      });

      subject = rendered.subject ?? undefined;
      body = rendered.body;
    }

    // Dispatch por canal
    switch (channel) {
      case 'email':
        return this.emailProvider.sendEmail({
          to: target,
          subject: subject ?? '(no subject)',
          body,
        });

      case 'sms':
        return this.smsProvider.sendSms({ to: target, body });

      case 'push':
        return this.pushProvider.sendPush({
          to: target,
          title: subject ?? 'Notification',
          body,
        });

      case 'webhook':
        return this.webhookProvider.sendWebhook({
          url: target,
          payload,
        });

      case 'in_app':
        console.log('[NotifyService] In-app notification', {
          tenantId,
          target,
          payload,
        });
        return { success: true };

      default:
        return { success: false, error: `Unsupported channel: ${channel}` };
    }
  }

  // ============================================================
  // RETRY MANUAL
  // ============================================================
  async retryNotification(
    tenantId: string,
    notificationId: string
  ): Promise<Notification | null> {
    const notif = await this.getById(tenantId, notificationId);
    if (!notif) return null;

    await runQueryWithTenant<void>(
      tenantId,
      `
      UPDATE notify_queue
      SET status = 'pending',
          retry_count = 0,
          last_error = NULL,
          scheduled_at = now()
      WHERE notification_id = $1
      `,
      [notificationId]
    );

    return this.getById(tenantId, notificationId);
  }
}

export const notifyService = new NotifyService();

