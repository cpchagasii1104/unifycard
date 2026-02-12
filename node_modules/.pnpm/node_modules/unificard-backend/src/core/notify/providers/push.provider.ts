// src/core/notify/providers/push.provider.ts
import type { ProviderResult } from '../notify.types';

export interface PushProviderConfig {
  // Firebase, OneSignal, etc config
  [key: string]: unknown;
}

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export class PushProvider {
  constructor(_config: PushProviderConfig) {
    // Config stub
  }

  async sendPush(message: PushMessage): Promise<ProviderResult> {
    // Stub - log only
    console.log('[PushProvider] Would send push:', {
      to: message.to,
      title: message.title,
      body: message.body,
    });

    return { success: true };
  }
}
