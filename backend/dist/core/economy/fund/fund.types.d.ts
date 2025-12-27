/**
 * Resumo do Fundo Regional
 * Dados explícitos sobre o estado atual do fundo
 */
export interface RegionalFundSummary {
    regionId?: string;
    regionName?: string;
    currentBalance: number;
    totalContributions: number;
    totalReceived: number;
    fromServices: {
        work: number;
    };
    lastUpdated: string;
    explanation: {
        text: string;
        example: string;
    };
    splitBreakdown: {
        worker: number;
        platform: number;
        regionalFund: number;
        community: number;
    };
}
/**
 * Entrada do histórico do fundo
 * Agregado por dia
 */
export interface RegionalFundHistoryEntry {
    date: string;
    amount: number;
    transactionCount: number;
}
/**
 * Histórico do Fundo Regional
 */
export interface RegionalFundHistory {
    regionId?: string;
    entries: RegionalFundHistoryEntry[];
    period: {
        start: string;
        end: string;
        days: number;
        label: string;
    };
    totalInPeriod: number;
}
/**
 * Projeção do Fundo Regional
 * Baseada em média diária dos últimos 30 dias
 */
export interface RegionalFundProjection {
    regionId?: string;
    currentBalance: number;
    dailyAverage: number;
    daysAnalyzed: number;
    estimates: {
        in30Days: {
            estimatedBalance: number;
            estimatedIncrease: number;
        };
        in90Days: {
            estimatedBalance: number;
            estimatedIncrease: number;
        };
    };
    calculatedAt: string;
    disclaimer: string;
}
/**
 * Visão completa do Fundo Regional
 * Combina resumo, histórico e projeção
 */
export interface RegionalFundView {
    summary: RegionalFundSummary;
    history: RegionalFundHistory;
    projection: RegionalFundProjection;
}
//# sourceMappingURL=fund.types.d.ts.map