"use strict";
// backend/src/core/notify/providers/sms.provider.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsProvider = void 0;
class SmsProvider {
    config;
    constructor(config) {
        this.config = config;
    }
    async sendSms(details) {
        console.log('[SmsProvider] Sending SMS', {
            from: this.config.fromNumber,
            to: details.to,
        });
        // TODO: Integrar com Twilio ou similar
        return { success: true };
    }
}
exports.SmsProvider = SmsProvider;
//# sourceMappingURL=sms.provider.js.map