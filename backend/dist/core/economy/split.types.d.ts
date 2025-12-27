export type SplitTargetType = 'WORKER' | 'TENANT' | 'PLATFORM' | 'REGION' | 'GROUP' | 'EVENT_ORGANIZER';
export interface SplitRule {
    targetType: SplitTargetType;
    targetIdKey?: 'workerUserId' | 'tenantId' | 'regionId' | 'groupId';
    percentage: number;
    description?: string;
}
export interface SplitConfig {
    tenantId: string;
    rules: SplitRule[];
    currency: string;
}
export interface SplitContext {
    tenantId: string;
    amount: number;
    currency: string;
    source: string;
    customerAccountId: string;
    workerAccountId?: string;
    tenantAccountId?: string;
    regionAccountId?: string;
    groupAccountIds?: string[];
    eventOrganizerAccountId?: string;
    metadata?: Record<string, any>;
}
export interface SplitResult {
    totalAmount: number;
    splits: Array<{
        rule: SplitRule;
        amount: number;
        transactionId?: string;
    }>;
}
//# sourceMappingURL=split.types.d.ts.map