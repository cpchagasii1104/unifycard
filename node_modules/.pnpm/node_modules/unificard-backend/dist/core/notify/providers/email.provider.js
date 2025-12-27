"use strict";
// backend/src/core/notify/providers/email.provider.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailProvider = void 0;
class EmailProvider {
    config;
    constructor(config) {
        this.config = config;
    }
    async sendEmail(details) {
        // Aqui você pode plugar SendGrid, SES, etc.
        // Por enquanto, só loga (para desenvolvimento).
        console.log('[EmailProvider] Sending email', {
            from: this.config.fromAddress,
            to: details.to,
            subject: details.subject,
        });
        // TODO: Integrar com provider real
        return { success: true };
    }
}
exports.EmailProvider = EmailProvider;
//# sourceMappingURL=email.provider.js.map