export interface FundSummary {
    regionId: string;
    balance: number;
    transactions: number;
    sources: {
        work: number;
    };
    lastUpdated: string;
}
export interface FundHistoryEntry {
    date: string;
    amount: number;
}
declare class FundService {
    /**
     * Obtém resumo do fundo regional
     */
    getSummary(tenantId: string): Promise<FundSummary>;
    /**
     * Obtém histórico do fundo regional agregado por dia
     */
    getHistory(tenantId: string, rangeDays?: number): Promise<FundHistoryEntry[]>;
}
export declare const fundService: FundService;
export {};
//# sourceMappingURL=fund.service.d.ts.map