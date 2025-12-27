import type { DecisionLog, DecisionLogFilters, DecisionDomain } from './decision-log.types';
/**
 * Serviço de log de decisões
 * Registra observações, sugestões e contextos
 * Read-only mode - não executa decisões
 */
declare class DecisionLogService {
    private readonly logsDir;
    private inMemoryLogs;
    constructor();
    /**
     * Carrega logs do disco para memória (read-only)
     */
    private loadLogsFromDisk;
    /**
     * Cria uma observação (não executa decisão)
     */
    createObservation(domain: DecisionDomain, policyKey: string, context: DecisionLog['context'], currentPolicyValue: number, options?: {
        suggestedValue?: number;
        insightsUsed?: DecisionLog['insightsUsed'];
        metadata?: Record<string, unknown>;
    }): Promise<DecisionLog>;
    /**
     * Persiste log em arquivo JSON
     */
    private persistLog;
    /**
     * Lista observações com filtros
     */
    listObservations(filters?: DecisionLogFilters): DecisionLog[];
    /**
     * Busca uma observação específica por ID
     */
    getObservationById(decisionId: string): DecisionLog | null;
}
export declare const decisionLogService: DecisionLogService;
export {};
//# sourceMappingURL=decision-log.service.d.ts.map