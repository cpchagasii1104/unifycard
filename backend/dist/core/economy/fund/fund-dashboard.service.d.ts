export interface RevenueByModule {
    module: string;
    totalAmount: number;
    transactionCount: number;
    percentage: number;
    lastTransactionDate?: string;
}
export interface OperationalCost {
    category: string;
    totalAmount: number;
    transactionCount: number;
    percentage: number;
    lastTransactionDate?: string;
}
export interface FundDashboardData {
    summary: {
        currentBalance: number;
        totalRevenue: number;
        totalCosts: number;
        netBalance: number;
        period: {
            start: string;
            end: string;
            days: number;
        };
    };
    revenue: {
        byModule: RevenueByModule[];
        total: number;
        growth: {
            currentPeriod: number;
            previousPeriod: number;
            percentage: number;
        };
    };
    costs: {
        byCategory: OperationalCost[];
        total: number;
        growth: {
            currentPeriod: number;
            previousPeriod: number;
            percentage: number;
        };
    };
    statistics: {
        averageDailyRevenue: number;
        averageDailyCosts: number;
        averageTransactionValue: number;
        mostActiveModule: string;
        mostProfitableModule: string;
    };
}
declare class FundDashboardService {
    /**
     * Obtém dados completos do dashboard do Fundo Regional
     */
    getDashboardData(tenantId: string, days?: number): Promise<FundDashboardData>;
    /**
     * Busca receitas agrupadas por módulo
     */
    private getRevenueByModule;
    /**
     * Busca custos agrupados por categoria
     */
    private getCostsByCategory;
}
export declare const fundDashboardService: FundDashboardService;
export {};
//# sourceMappingURL=fund-dashboard.service.d.ts.map