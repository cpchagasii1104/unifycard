import type { AIKernel } from '../ai/ai-kernel';
import type { IntentType, IntentAnalysis, SuggestedAction, FlowStep } from './orchestrator.types';
/**
 * Analisa texto usando AI Kernel para identificar intents
 */
export declare function analyzeIntentWithAI(aiKernel: AIKernel, text: string, context?: any): Promise<IntentAnalysis[]>;
/**
 * Gera ações sugeridas baseadas nas intents identificadas
 */
export declare function generateSuggestedActions(intents: IntentAnalysis[], categories: any[]): SuggestedAction[];
/**
 * Gera fluxo de próximos passos baseado na intent
 */
export declare function generateFlowSteps(intent: IntentType): FlowStep[];
//# sourceMappingURL=orchestrator.ai.d.ts.map