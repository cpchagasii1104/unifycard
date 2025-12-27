export interface StatementEntry {
    transactionId: string;
    type: 'p2p' | 'donation' | 'split' | 'compensation' | 'other';
    amount: number;
    direction: 'in' | 'out';
    balanceAfter: number;
    createdAt: Date;
    metadata: {
        type?: string;
        targetType?: string;
        targetId?: string;
        originTransactionId?: string;
        splitGroupId?: string;
        message?: string;
        [key: string]: any;
    };
}
export interface StatementResult {
    entries: StatementEntry[];
    total: number;
    hasMore: boolean;
}
export interface SplitDetail {
    baseTransaction: {
        transactionId: string;
        amount: number;
        type: string;
        createdAt: Date;
        metadata: Record<string, any>;
    };
    splits: Array<{
        transactionId: string;
        targetType: 'user' | 'group' | 'project' | 'regional_fund' | 'platform';
        targetId?: string;
        percentage: number;
        amount: number;
        createdAt: Date;
    }>;
    totalPercentage: number;
    totalAmount: number;
}
export interface RegionalFundEntry {
    transactionId: string;
    type: 'credit' | 'debit';
    amount: number;
    origin: string;
    originTransactionId?: string;
    destination?: string;
    context?: string;
    createdAt: Date;
    metadata: Record<string, any>;
}
export interface RegionalFundView {
    accountId: string;
    regionId?: string;
    currentBalance: number;
    entries: RegionalFundEntry[];
    summary: {
        totalIn: number;
        totalOut: number;
        netAmount: number;
    };
}
export interface RegionalFundAdminView {
    regionId: string;
    accountId: string;
    currentBalance: number;
    entries: RegionalFundEntry[];
    summary: {
        totalIn: number;
        totalOut: number;
        netAmount: number;
        byOrigin: Record<string, number>;
        byContext: Record<string, number>;
        byPeriod: Array<{
            period: string;
            totalIn: number;
            totalOut: number;
        }>;
    };
}
declare class TransparencyService {
    /**
     * Obtém extrato financeiro do usuário
     * Usa dados do ledger (não recalcula saldo)
     */
    getUserStatement(tenantId: string, globalUserId: string, options?: {
        limit?: number;
        offset?: number;
        startDate?: Date;
        endDate?: Date;
    }): Promise<StatementResult>;
    /**
     * Obtém detalhe de split de uma transação base
     * Busca todas as transações que compartilham o mesmo splitGroupId
     */
    getTransactionSplits(tenantId: string, transactionId: string): Promise<SplitDetail | null>;
    /**
     * Obtém visão do fundo regional para o usuário
     */
    getUserRegionalFund(tenantId: string, globalUserId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<RegionalFundView | null>;
    /**
     * Obtém visão administrativa do fundo regional
     */
    getAdminRegionalFund(tenantId: string, regionId: string, options?: {
        limit?: number;
        offset?: number;
        startDate?: Date;
        endDate?: Date;
    }): Promise<RegionalFundAdminView | null>;
    /**
     * Helper: obtém userId a partir de globalUserId
     */
    private getUserIdFromGlobalId;
}
export declare const transparencyService: TransparencyService;
export {};
//# sourceMappingURL=transparency.service.d.ts.map