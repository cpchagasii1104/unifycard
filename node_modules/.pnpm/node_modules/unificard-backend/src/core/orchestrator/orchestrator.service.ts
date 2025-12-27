// src/core/orchestrator/orchestrator.service.ts
import type { FastifyInstance } from 'fastify';
import { categoriesService } from '../categories/categories.service';
import {
  analyzeIntentWithAI,
  generateSuggestedActions,
  generateFlowSteps,
} from './orchestrator.ai';
import { OrchestratorModel } from './orchestrator.model';
import { INTENT_EXECUTORS } from './orchestrator.executors';
import type {
  AnalyzeTextInput,
  TextAnalysis,
  ExecuteIntentInput,
  ExecutionResult,
  IntentModuleMapping,
  TargetModule,
  IntentType,
} from './orchestrator.types';

/**
 * Mapeamento de intents para módulos
 */
const INTENT_MODULE_MAPPING: IntentModuleMapping[] = [
  { intent: 'hire_service', module: 'work', endpoint: '/work/workers/search' },
  { intent: 'buy_product', module: 'commerce', endpoint: '/commerce/products/search' },
  { intent: 'request_ride', module: 'rides', endpoint: '/rides/request' },
  { intent: 'book_event', module: 'events', endpoint: '/events/search' },
  { intent: 'schedule_service', module: 'work', endpoint: '/work/schedule' },
  { intent: 'order_food', module: 'commerce', endpoint: '/commerce/restaurants/search' },
  { intent: 'delivery_pickup', module: 'delivery', endpoint: '/delivery/request' },
  { intent: 'search_local', module: 'marketplace', endpoint: '/marketplace/search' },
  { intent: 'post_content', module: 'marketplace', endpoint: '/marketplace/posts/create' },
  { intent: 'ask_question', module: 'orchestrator', endpoint: '/orchestrator/answer' },
  { intent: 'support', module: 'identity', endpoint: '/identity/support' },
];

class OrchestratorService {
  /**
   * Analisa texto do usuário e identifica intents, categorias e ações
   */
  async analyzeText(
    fastify: FastifyInstance,
    input: AnalyzeTextInput,
    userId?: string,
    tenantId?: string
  ): Promise<TextAnalysis> {
    // 1. Classificar texto em categorias
    const categoryClassifications = await categoriesService.classifyTextIntoCategories({
      text: input.text,
      maxCategories: 5,
    });

    // 2. Analisar intents usando AI Kernel
    const aiKernel = fastify.ai;
    const intentAnalyses = await analyzeIntentWithAI(aiKernel, input.text, {
      ...input.context,
      userId,
      tenantId,
      categories: categoryClassifications,
    });

    // 3. Ordenar intents por confiança
    const sortedIntents = intentAnalyses.sort((a, b) => b.confidence - a.confidence);

    // 4. Calcular confiança geral (média das top intents)
    const topIntents = sortedIntents.slice(0, 3);
    const overallConfidence =
      topIntents.length > 0
        ? topIntents.reduce((sum, i) => sum + i.confidence, 0) / topIntents.length
        : 0;

    // 5. Gerar ações sugeridas
    const suggestedActions = generateSuggestedActions(
      sortedIntents,
      categoryClassifications
    );

    // 6. Gerar fluxo de próximos passos (baseado na intent principal)
    const primaryIntent = sortedIntents[0];
    const nextFlow = primaryIntent ? generateFlowSteps(primaryIntent.intent) : undefined;

    return OrchestratorModel.normalizeTextAnalysis({
      intents: sortedIntents,
      categories: categoryClassifications.map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        categoryPath: c.path,
        relevance: c.confidence,
      })),
      confidence: overallConfidence,
      suggestedActions,
      nextFlow,
    });
  }

  /**
   * Roteia intent para o módulo correto
   */
  routeIntent(intent: IntentType, targetModule?: TargetModule): IntentModuleMapping {
    // Se módulo foi especificado, usar ele
    if (targetModule) {
      const mapping = INTENT_MODULE_MAPPING.find((m) => m.intent === intent);
      if (mapping) {
        return { ...mapping, module: targetModule };
      }
    }

    // Buscar mapeamento padrão
    const mapping = INTENT_MODULE_MAPPING.find((m) => m.intent === intent);
    if (!mapping) {
      throw new Error(`Intent "${intent}" não possui mapeamento para módulo`);
    }

    return mapping;
  }

  /**
   * Executa uma intent roteando para o módulo correto
   */
  async execute(
    fastify: FastifyInstance,
    input: ExecuteIntentInput
  ): Promise<ExecutionResult> {
    try {
      // 1. Rotear intent
      const mapping = this.routeIntent(input.intent, input.targetModule);

      // 2. Buscar executor para a intent
      const executor = INTENT_EXECUTORS[input.intent];
      if (!executor) {
        return {
          success: false,
          intent: input.intent,
          module: mapping.module,
          error: `Executor não encontrado para intent: ${input.intent}`,
        };
      }

      // 3. Executar usando o executor específico
      let executorResult;
      try {
        executorResult = await executor(
          fastify,
          input.parameters,
          input.userId,
          input.tenantId
        );
      } catch (err) {
        return {
          success: false,
          intent: input.intent,
          module: mapping.module,
          error: err instanceof Error ? err.message : 'Erro desconhecido ao executar',
        };
      }

      // 4. Converter resultado do executor para ExecutionResult
      const executionResult: ExecutionResult = {
        success: executorResult.ok,
        intent: input.intent,
        module: mapping.module,
        result: executorResult.result,
        error: executorResult.error,
      };

      // 5. Gerar próximos passos se sucesso
      if (executorResult.ok) {
        executionResult.nextSteps = generateFlowSteps(input.intent);
      }

      return executionResult;
    } catch (err) {
      return {
        success: false,
        intent: input.intent,
        module: input.targetModule || 'orchestrator',
        error: err instanceof Error ? err.message : 'Erro desconhecido',
      };
    }
  }
}

export const orchestratorService = new OrchestratorService();

