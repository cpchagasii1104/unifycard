/**
 * Decisões de precedência institucional (ATL → KYC → GUARDA) para ações sensíveis.
 * Fonte única de orquestração; regras concretas permanecem nos módulos existentes (risk, SSOT).
 */

export type AuthorityDecision = 'allow' | 'block' | 'limit';

export type AuthorityDecisionSource = 'system' | 'manual' | 'rule' | 'AI';

export interface AuthorityLayerTrace {
  layer: 'ATL' | 'KYC' | 'GUARDA' | 'REST';
  outcome: 'pass' | 'block' | 'limit' | 'skip';
  reason: string;
}

export interface AuthorityFinancialEvaluation {
  decision: AuthorityDecision;
  reason: string;
  source: AuthorityDecisionSource;
  /** Regras determinísticas: 1; agregados de risco: alta confiança sem ser probabilística */
  confidence: number;
  requiresStepUp: boolean;
  riskLevel?: string;
  layers: AuthorityLayerTrace[];
}