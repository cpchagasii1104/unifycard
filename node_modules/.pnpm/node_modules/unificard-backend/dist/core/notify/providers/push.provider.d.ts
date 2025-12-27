import type { ProviderResult } from '../notify.types';
export interface PushProviderConfig {
    [key: string]: unknown;
}
export interface PushMessage {
    to: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
}
export declare class PushProvider {
    constructor(_config: PushProviderConfig);
    sendPush(message: PushMessage): Promise<ProviderResult>;
}
//# sourceMappingURL=push.provider.d.ts.map