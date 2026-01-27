"use strict";
// src/core/orchestrator/orchestrator.model.ts
// Model para conversão e validação de dados do orchestrator
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestratorModel = void 0;
class OrchestratorModel {
    /**
     * Valida e normaliza análise de texto
     */
    static normalizeTextAnalysis(data) {
        return {
            intents: (data.intents || []).map((i) => this.normalizeIntentAnalysis(i)),
            categories: (data.categories || []).map((c) => this.normalizeCategoryMatch(c)),
            confidence: Math.max(0, Math.min(1, data.confidence || 0)),
            suggestedActions: (data.suggestedActions || []).map((a) => this.normalizeSuggestedAction(a)),
            nextFlow: data.nextFlow ? data.nextFlow.map((f) => this.normalizeFlowStep(f)) : undefined,
        };
    }
    /**
     * Normaliza análise de intent
     */
    static normalizeIntentAnalysis(data) {
        return {
            intent: data.intent,
            confidence: Math.max(0, Math.min(1, data.confidence || 0)),
            parameters: data.parameters || {},
            reasoning: data.reasoning,
        };
    }
    /**
     * Normaliza match de categoria
     */
    static normalizeCategoryMatch(data) {
        return {
            categoryId: data.categoryId,
            categoryName: data.categoryName || '',
            categoryPath: Array.isArray(data.categoryPath) ? data.categoryPath : [],
            relevance: Math.max(0, Math.min(1, data.relevance || 0)),
        };
    }
    /**
     * Normaliza ação sugerida
     */
    static normalizeSuggestedAction(data) {
        return {
            action: data.action || '',
            module: data.module,
            endpoint: data.endpoint,
            payload: data.payload || {},
            description: data.description || '',
        };
    }
    /**
     * Normaliza passo do fluxo
     */
    static normalizeFlowStep(data) {
        return {
            step: data.step || 1,
            module: data.module,
            action: data.action || '',
            description: data.description || '',
            required: data.required !== undefined ? data.required : true,
        };
    }
    /**
     * Normaliza resultado de execução
     */
    static normalizeExecutionResult(data) {
        return {
            success: data.success === true,
            intent: data.intent,
            module: data.module,
            result: data.result,
            error: data.error,
            nextSteps: data.nextSteps ? data.nextSteps.map((s) => this.normalizeFlowStep(s)) : undefined,
        };
    }
}
exports.OrchestratorModel = OrchestratorModel;
