/**
 * Filtros para buscar eventos
 */
export interface EventFilters {
    tenantId?: string;
    sourceModule?: string;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    regionId?: string;
    userId?: string;
    minAmount?: number;
    maxAmount?: number;
}
/**
 * Regras de simulação
 */
export interface SimulationRules {
    regionalSplitPercentage?: number;
    [key: string]: unknown;
}
/**
 * Resultado de uma simulação
 */
export interface SimulationResult {
    simulationId: string;
    simulationType: string;
    rules: SimulationRules;
    actualValue: number;
    simulatedValue: number;
    delta: number;
    percentageChange: number;
    eventCount: number;
    period: {
        start: string;
        end: string;
    };
    metadata?: Record<string, unknown>;
}
//# sourceMappingURL=simulation.types.d.ts.map