export type SplitContextType = 'donation' | 'service' | 'event' | 'marketplace';
export type SplitTargetType = 'user' | 'group' | 'project' | 'regional_fund' | 'platform';
export interface SplitRule {
    id: string;
    context: SplitContextType;
    cityId?: string;
    module?: string;
    rules: Array<{
        targetType: SplitTargetType;
        targetId?: string;
        percentage: number;
    }>;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface ApplySplitInput {
    baseTransactionId: string;
    amount: number;
    context: SplitContextType;
    metadata?: Record<string, any>;
    splitRuleId?: string;
    tenantId: string;
}
export interface SplitEntry {
    ruleId: string;
    targetType: SplitTargetType;
    targetId?: string;
    percentage: number;
    amount: number;
    accountId: string;
    transactionId: string;
    ledgerEntryId: string;
}
export interface ApplySplitResult {
    splitGroupId: string;
    baseTransactionId: string;
    totalAmount: number;
    entries: SplitEntry[];
    createdAt: Date;
}
export interface CompensateTransactionInput {
    originTransactionId: string;
    reason: string;
    metadata?: Record<string, any>;
    tenantId: string;
}
export interface CompensateTransactionResult {
    compensationTransactionId: string;
    originTransactionId: string;
    reversedEntries: Array<{
        originalEntryId: string;
        compensationEntryId: string;
    }>;
    createdAt: Date;
}
//# sourceMappingURL=split-engine.types.d.ts.map