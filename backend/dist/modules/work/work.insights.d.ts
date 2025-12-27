export interface WorkSummary {
    summary: string;
    jobId: string;
    assignmentId: string;
    timestamp: string;
}
export interface JobHistoryEntry {
    jobId: string;
    timestamp: string;
    status?: string;
}
export interface PerformanceScore {
    score: number;
    completedAssignments: number;
    totalAssignments: number;
    completionRate: number;
}
export interface WorkPatterns {
    preferredHours: Array<{
        hour: number;
        count: number;
    }>;
    averageSessionDuration?: number;
    mostFrequentJobTypes: Array<{
        type: string;
        count: number;
    }>;
}
/**
 * Busca os últimos resumos de sessões de trabalho
 */
export declare function getLatestSummaries(userId: string, limit?: number): Promise<WorkSummary[]>;
/**
 * Busca histórico de jobs criados pelo usuário
 */
export declare function getJobHistory(userId: string, limit?: number): Promise<JobHistoryEntry[]>;
/**
 * Calcula score de performance do usuário
 */
export declare function getPerformanceScore(userId: string): Promise<PerformanceScore>;
/**
 * Detecta padrões de trabalho do usuário
 */
export declare function getWorkPatterns(userId: string): Promise<WorkPatterns>;
//# sourceMappingURL=work.insights.d.ts.map