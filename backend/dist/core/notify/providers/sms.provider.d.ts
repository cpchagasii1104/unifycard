import { ProviderResult, SmsDetails } from '../notify.types';
export interface SmsProviderConfig {
    fromNumber?: string;
}
export declare class SmsProvider {
    private readonly config;
    constructor(config: SmsProviderConfig);
    sendSms(details: SmsDetails): Promise<ProviderResult>;
}
//# sourceMappingURL=sms.provider.d.ts.map