import type { FastifyInstance } from 'fastify';
import type { AnalyzeTextInput, TextAnalysis, ExecuteIntentInput, ExecutionResult, IntentModuleMapping, TargetModule, IntentType } from './orchestrator.types';
declare class OrchestratorService {
    /**
     * Analisa texto do usuário e identifica intents, categorias e ações
     */
    analyzeText(fastify: FastifyInstance, input: AnalyzeTextInput, userId?: string, tenantId?: string): Promise<TextAnalysis>;
    /**
     * Roteia intent para o módulo correto
     */
    routeIntent(intent: IntentType, targetModule?: TargetModule): IntentModuleMapping;
    /**
     * Executa uma intent roteando para o módulo correto
     */
    execute(fastify: FastifyInstance, input: ExecuteIntentInput): Promise<ExecutionResult>;
}
export declare const orchestratorService: OrchestratorService;
export {};
//# sourceMappingURL=orchestrator.service.d.ts.map