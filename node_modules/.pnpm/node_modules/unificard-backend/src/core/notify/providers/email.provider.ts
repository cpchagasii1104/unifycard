// backend/src/core/notify/providers/email.provider.ts

import { EmailDetails, ProviderResult } from '../notify.types';

export interface EmailProviderConfig {
  fromAddress: string;
  // futuro: apiKey, providerName etc
}

export class EmailProvider {
  constructor(private readonly config: EmailProviderConfig) {}

  async sendEmail(details: EmailDetails): Promise<ProviderResult> {
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
