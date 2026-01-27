// backend/src/core/notify/providers/sms.provider.ts

import { ProviderResult, SmsDetails } from '../notify.types';

export interface SmsProviderConfig {
  fromNumber?: string;
  // futuro: apiKey, providerName etc
}

export class SmsProvider {
  constructor(private readonly config: SmsProviderConfig) {}

  async sendSms(details: SmsDetails): Promise<ProviderResult> {
    console.log('[SmsProvider] Sending SMS', {
      from: this.config.fromNumber,
      to: details.to,
    });

    // TODO: Integrar com Twilio ou similar
    return { success: true };
  }
}
