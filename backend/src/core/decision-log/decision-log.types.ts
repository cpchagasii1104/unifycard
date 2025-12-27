// src/core/decision-log/decision-log.types.ts
// Tipos para log de decisões estratégicas

/**
 * Domínios de decisão
 */
export type DecisionDomain = 'economy' | 'fund' | 'work' | 'rides';

/**
 * Status de uma decisão
 */
export type DecisionStatus = 'observed' | 'decided' | 'executed';

/**
 * Interface de log de decisão
 */
export interface DecisionLog {
  decisionId: string;
  domain: DecisionDomain;
  policyKey: string;
  context: {
    regionId?: string;
    module?: string;
    demandIndex?: number;
    supplyIndex?: number;
    growthRate?: number;
    [key: string]: unknown;
  };
  currentPolicyValue: number;
  suggestedValue?: number;
  insightsUsed: Array<{
    insightId?: string;
    insightType?: string;
    message?: string;
  }>;
  decision: null; // Por enquanto sempre null
  status: DecisionStatus;
  createdAt: string; // ISO date string
  metadata?: Record<string, unknown>;
}

/**
 * Filtros para listar observações
 */
export interface DecisionLogFilters {
  domain?: DecisionDomain;
  policyKey?: string;
  status?: DecisionStatus;
  regionId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}



