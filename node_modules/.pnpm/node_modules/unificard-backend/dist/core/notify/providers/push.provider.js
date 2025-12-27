"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushProvider = void 0;
class PushProvider {
    constructor(_config) {
        // Config stub
    }
    async sendPush(message) {
        // Stub - log only
        console.log('[PushProvider] Would send push:', {
            to: message.to,
            title: message.title,
            body: message.body,
        });
        return { success: true };
    }
}
exports.PushProvider = PushProvider;
//# sourceMappingURL=push.provider.js.map