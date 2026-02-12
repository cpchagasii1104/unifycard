"use strict";
// backend/src/core/notify/providers/templates.provider.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateProvider = void 0;
const pool_1 = require("@core/database/pool");
function mapTemplateRow(row) {
    return {
        templateId: row.template_id,
        tenantId: row.tenant_id,
        channel: row.channel,
        name: row.name,
        description: row.description,
        subject: row.subject,
        body: row.body,
        metadata: row.metadata ?? {},
        isActive: row.is_active,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
class TemplateProvider {
    async getTemplate(tenantId, channel, name) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT template_id, tenant_id, channel, name, description, subject, body, metadata, is_active,
             createdAt, updatedAt
      FROM notify_templates
      WHERE channel = $1 AND name = $2 AND is_active = TRUE
      LIMIT 1
      `, [channel, name]);
        if (!row) {
            return null;
        }
        return mapTemplateRow(row);
    }
    renderTemplate(template, context) {
        const merge = (text) => {
            if (!text)
                return text ?? null;
            return text.replace(/\{\{(\w+(\.\w+)*)\}\}/g, (_, path) => {
                const segments = path.split('.');
                let valueCents = context.payload;
                for (const segment of segments) {
                    if (value && typeof value === 'object' && segment in value) {
                        value = value[segment];
                    }
                    else {
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
exports.TemplateProvider = TemplateProvider;
