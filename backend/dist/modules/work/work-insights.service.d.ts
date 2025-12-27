import { type WorkSummary, type JobHistoryEntry, type PerformanceScore, type WorkPatterns } from './work.insights';
declare class WorkInsightsService {
    /**
     * Retorna resumo das últimas sessões de trabalho
     */
    getSummary(tenantId: string, userId: string, limit?: number): Promise<WorkSummary[]>;
    /**
     * Retorna histórico de jobs do usuário
     */
    getHistory(tenantId: string, userId: string, limit?: number): Promise<JobHistoryEntry[]>;
    /**
     * Calcula e retorna score de performance
     */
    getPerformance(tenantId: string, userId: string): Promise<PerformanceScore>;
    /**
     * Detecta e retorna padrões de trabalho
     */
    getPatterns(tenantId: string, userId: string): Promise<WorkPatterns>;
}
export declare const workInsightsService: WorkInsightsService;
export {};
//# sourceMappingURL=work-insights.service.d.ts.map