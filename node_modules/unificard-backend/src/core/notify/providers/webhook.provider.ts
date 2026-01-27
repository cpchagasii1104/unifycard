// backend/src/core/notify/providers/webhook.provider.ts

import { ProviderResult, WebhookDetails } from '../notify.types';
import https from 'https';
import http from 'http';
import { URL } from 'url';

export class WebhookProvider {
  async sendWebhook(details: WebhookDetails): Promise<ProviderResult> {
    try {
      const url = new URL(details.url);
      const isHttps = url.protocol === 'https:';

      const options: https.RequestOptions = {
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

      await new Promise<void>((resolve, reject) => {
        const req = (isHttps ? https.request : http.request)(options, res => {
          const chunks: Buffer[] = [];
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
    } catch (error: any) {
      console.error('[WebhookProvider] Error sending webhook', error);
      return { success: false, error: error?.message || 'Webhook error' };
    }
  }
}
