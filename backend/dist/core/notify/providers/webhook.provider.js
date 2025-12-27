"use strict";
// backend/src/core/notify/providers/webhook.provider.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookProvider = void 0;
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const url_1 = require("url");
class WebhookProvider {
    async sendWebhook(details) {
        try {
            const url = new url_1.URL(details.url);
            const isHttps = url.protocol === 'https:';
            const options = {
                method: 'POST',
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                headers: {
                    'Content-Type': 'application/json',
                    ...(details.headers ?? {}),
                },
            };
            const payload = JSON.stringify(details.payload);
            await new Promise((resolve, reject) => {
                const req = (isHttps ? https_1.default.request : http_1.default.request)(options, res => {
                    const chunks = [];
                    res.on('data', chunk => chunks.push(chunk));
                    res.on('end', () => {
                        const body = Buffer.concat(chunks).toString('utf8');
                        console.log('[WebhookProvider] Response', {
                            statusCode: res.statusCode,
                            body,
                        });
                        resolve();
                    });
                });
                req.on('error', reject);
                req.write(payload);
                req.end();
            });
            return { success: true };
        }
        catch (error) {
            console.error('[WebhookProvider] Error sending webhook', error);
            return { success: false, error: error?.message || 'Webhook error' };
        }
    }
}
exports.WebhookProvider = WebhookProvider;
//# sourceMappingURL=webhook.provider.js.map