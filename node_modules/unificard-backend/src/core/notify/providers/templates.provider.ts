// backend/src/core/notify/providers/templates.provider.ts

import { runQueryWithTenant } from '@core/database/pool';
import {
  NotificationChannel,
  NotificationPayload,
  NotifyTemplate,
  NotifyTemplateRow,
  TemplateRenderContext,
} from '../notify.types';

function mapTemplateRow(row: NotifyTemplateRow): NotifyTemplate {
  return {
    templateId: row.template_id,
    tenantId: row.tenant_id,
    channel: row.channel as NotificationChannel,
    name: row.name,
    description: row.description,
    subject: row.subject,
    body: row.body,
    metadata: (row.metadata as NotificationPayload) ?? {},
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TemplateProvider {
  async getTemplate(
    tenantId: string,
    channel: NotificationChannel,
    name: string
  ): Promise<NotifyTemplate | null> {
    const row = await runQueryWithTenant<NotifyTemplateRow>(
      tenantId,
      `
      SELECT template_id, tenant_id, channel, name, description, subject, body, metadata, is_active,
             created_at, updated_at
      FROM notify_templates
      WHERE channel = $1 AND name = $2 AND is_active = TRUE
      LIMIT 1
      `,
      [channel, name]
    );

    if (!row) {
      return null;
    }

    return mapTemplateRow(row);
  }

  renderTemplate(
    template: NotifyTemplate,
    context: TemplateRenderContext
  ): { subject?: string | null; body: string } {
    const merge = (text: string | null | undefined): string | null => {
      if (!text) return text ?? null;

      return text.replace(/\{\{(\w+(\.\w+)*)\}\}/g, (_, path: string) => {
        const segments = path.split('.');
        let value: any = context.payload;

        for (const segment of segments) {
          if (value && typeof value === 'object' && segment in value) {
            value = value[segment];
          } else {
            value = undefined;
            break;
          }
        }

        return value != null ? String(value) : '';
      });
    };

    const renderedSubject = merge(template.subject);
    const renderedBody = merge(template.body) ?? '';

    return {
      subject: renderedSubject,
      body: renderedBody,
    };
  }
}
