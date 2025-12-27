export interface WeeklyReport {
    week: string;
    weekStart: string;
    weekEnd: string;
    regions: RegionWeeklyData[];
    topRegion: string | null;
    bottomRegion: string | null;
    summary: {
        totalRegions: number;
        totalAccumulated: number;
        totalGrowth: number;
        totalTransactions: number;
    };
    generatedAt: string;
}
export interface RegionWeeklyData {
    regionId: string;
    regionName?: string;
    totalAccumulated: number;
    weekGrowth: number;
    weekTransactions: number;
    balance: number;
}
declare class FundWeeklyReportService {
    private readonly reportsDir;
    constructor();
    /**
     * Calcula número da semana ISO (YYYY-WW)
     */
    private getWeekNumber;
    /**
     * Calcula início e fim da semana (segunda a domingo)
     */
    private getWeekRange;
    /**
     * Gera relatório semanal do fundo regional
     */
    generateWeeklyReport(tenantId: string): Promise<WeeklyReport>;
    /**
     * Salva relatório em arquivo JSON
     */
    private saveReport;
    /**
     * Busca relatório mais recente
     */
    getLatestReport(tenantId: string): Promise<WeeklyReport | null>;
    /**
     * Lista todos os relatórios disponíveis
     */
    listReports(tenantId: string): Promise<string[]>;
}
export declare const fundWeeklyReportService: FundWeeklyReportService;
export {};
//# sourceMappingURL=fund-weekly-report.service.d.ts.map