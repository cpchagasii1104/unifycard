import type { TextAnalysis, IntentAnalysis, CategoryMatch, SuggestedAction, FlowStep, ExecutionResult } from './orchestrator.types';
export declare class OrchestratorModel {
    /**
     * Valida e normaliza análise de texto
     */
    static normalizeTextAnalysis(data: any): TextAnalysis;
    /**
     * Normaliza análise de intent
     */
    static normalizeIntentAnalysis(data: any): IntentAnalysis;
    /**
     * Normaliza match de categoria
     */
    static normalizeCategoryMatch(data: any): CategoryMatch;
    /**
     * Normaliza ação sugerida
     */
    static normalizeSuggestedAction(data: any): SuggestedAction;
    /**
     * Normaliza passo do fluxo
     */
    static normalizeFlowStep(data: any): FlowStep;
    /**
     * Normaliza resultado de execução
     */
    static normalizeExecutionResult(data: any): ExecutionResult;
}
//# sourceMappingURL=orchestrator.model.d.ts.map