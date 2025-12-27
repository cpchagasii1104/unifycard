/**
 * Tipos de insights
 */
export type InsightType = 'trend' | 'anomaly' | 'projection';
/**
 * Domínios de insights
 */
export type InsightDomain = 'fund' | 'economy' | 'work';
/**
 * Severidade do insight
 */
export type InsightSeverity = 'info' | 'warning' | 'opportunity';
/**
 * Interface de um insight
 */
export interface Insight {
    id: string;
    type: InsightType;
    domain: InsightDomain;
    severity: InsightSeverity;
    message: string;
    data: Record<string, unknown>;
    generatedAt: string;
}
/**
 * Input para geração de insights
 */
export interface InsightInput {
    canonicalEvents: Array<import('../orchestrator/contracts/canonical-event').CanonicalEvent>;
    policies?: Array<import('../policy/policy.types').Policy>;
    simulationResults?: Array<import('../simulation/simulation.types').SimulationResult>;
    period?: {
        start: string;
        end: string;
    };
}
//# sourceMappingURL=insight.types.d.ts.map