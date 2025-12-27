import { NotificationChannel, NotifyTemplate, TemplateRenderContext } from '../notify.types';
export declare class TemplateProvider {
    getTemplate(tenantId: string, channel: NotificationChannel, name: string): Promise<NotifyTemplate | null>;
    renderTemplate(template: NotifyTemplate, context: TemplateRenderContext): {
        subject?: string | null;
        body: string;
    };
}
//# sourceMappingURL=templates.provider.d.ts.map