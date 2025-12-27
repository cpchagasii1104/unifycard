import { EmailDetails, ProviderResult } from '../notify.types';
export interface EmailProviderConfig {
    fromAddress: string;
}
export declare class EmailProvider {
    private readonly config;
    constructor(config: EmailProviderConfig);
    sendEmail(details: EmailDetails): Promise<ProviderResult>;
}
//# sourceMappingURL=email.provider.d.ts.map