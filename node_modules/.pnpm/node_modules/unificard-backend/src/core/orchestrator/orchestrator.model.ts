// src/core/orchestrator/orchestrator.model.ts
// Model para conversão e validação de dados do orchestrator

import type {
  TextAnalysis,
  IntentAnalysis,
  CategoryMatch,
  SuggestedAction,
  FlowStep,
  ExecutionResult,
} from './orchestrator.types';

export class OrchestratorModel {
  /**
   * Valida e normaliza análise de texto
   */
  static normalizeTextAnalysis(data: any): TextAnalysis {
    return {
      intents: (data.intents || []).map((i: any) => this.normalizeIntentAnalysis(i)),
      categories: (data.categories || []).map((c: any) => this.normalizeCategoryMatch(c)),
      confidence: Math.max(0, Math.min(1, data.confidence || 0)),
      suggestedActions: (data.suggestedActions || []).map((a: any) => this.normalizeSuggestedAction(a)),
      nextFlow: data.nextFlow ? data.nextFlow.map((f: any) => this.normalizeFlowStep(f)) : undefined,
    };
  }

  /**
   * Normaliza análise de intent
   */
  static normalizeIntentAnalysis(data: any): IntentAnalysis {
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
  static normalizeCategoryMatch(data: any): CategoryMatch {
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
  static normalizeSuggestedAction(data: any): SuggestedAction {
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
  static normalizeFlowStep(data: any): FlowStep {
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
  static normalizeExecutionResult(data: any): ExecutionResult {
    return {
      success: data.success === true,
      intent: data.intent,
      module: data.module,
      result: data.result,
      error: data.error,
      nextSteps: data.nextSteps ? data.nextSteps.map((s: any) => this.normalizeFlowStep(s)) : undefined,
    };
  }
}








