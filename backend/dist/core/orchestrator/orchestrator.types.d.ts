/**
 * Intents suportadas pelo sistema
 */
export type IntentType = 'hire_service' | 'buy_product' | 'request_ride' | 'book_event' | 'schedule_service' | 'order_food' | 'delivery_pickup' | 'search_local' | 'post_content' | 'ask_question' | 'support';
/**
 * Módulos do sistema que podem receber intents
 */
export type TargetModule = 'work' | 'events' | 'rides' | 'marketplace' | 'commerce' | 'delivery' | 'identity' | 'categories' | 'orchestrator';
/**
 * Análise de texto do usuário
 */
export interface TextAnalysis {
    intents: IntentAnalysis[];
    categories: CategoryMatch[];
    confidence: number;
    suggestedActions: SuggestedAction[];
    nextFlow?: FlowStep[];
}
/**
 * Análise de uma intent específica
 */
export interface IntentAnalysis {
    intent: IntentType;
    confidence: number;
    parameters?: Record<string, any>;
    reasoning?: string;
}
/**
 * Match de categoria
 */
export interface CategoryMatch {
    categoryId: string;
    categoryName: string;
    categoryPath: string[];
    relevance: number;
}
/**
 * Ação sugerida
 */
export interface SuggestedAction {
    action: string;
    module: TargetModule;
    endpoint?: string;
    payload?: Record<string, any>;
    description: string;
}
/**
 * Passo do fluxo
 */
export interface FlowStep {
    step: number;
    module: TargetModule;
    action: string;
    description: string;
    required?: boolean;
}
/**
 * Resultado da execução de uma intent
 */
export interface ExecutionResult {
    success: boolean;
    intent: IntentType;
    module: TargetModule;
    result?: any;
    error?: string;
    nextSteps?: FlowStep[];
}
/**
 * Input para análise de texto
 */
export interface AnalyzeTextInput {
    text: string;
    audioUrl?: string;
    context?: {
        location?: {
            latitude: number;
            longitude: number;
            cityId?: string;
        };
        previousIntent?: IntentType;
        userId?: string;
    };
}
/**
 * Input para execução de intent
 */
export interface ExecuteIntentInput {
    intent: IntentType;
    parameters: Record<string, any>;
    targetModule?: TargetModule;
    userId: string;
    tenantId: string;
}
/**
 * Mapeamento de intent para módulo
 */
export interface IntentModuleMapping {
    intent: IntentType;
    module: TargetModule;
    endpoint?: string;
    requiredParams?: string[];
}
/**
 * Resposta de análise
 */
export interface AnalyzeResponse {
    analysis: TextAnalysis;
    executionReady: boolean;
    suggestedExecution?: ExecuteIntentInput;
}
//# sourceMappingURL=orchestrator.types.d.ts.map