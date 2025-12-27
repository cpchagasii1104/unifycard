// src/core/orchestrator/orchestrator.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { orchestratorService } from './orchestrator.service';
import { analyzeTextSchema, executeIntentSchema } from './orchestrator.schemas';
import type { AnalyzeTextInput, ExecuteIntentInput } from './orchestrator.types';

const orchestratorRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /orchestrator/analyze
   * Analisa texto do usuário e identifica intents, categorias e ações sugeridas
   */
  fastify.post<{
    Body: {
      text: string;
      audioUrl?: string;
      context?: {
        location?: {
          latitude: number;
          longitude: number;
          cityId?: string;
        };
        previousIntent?: string;
        userId?: string;
      };
    };
  }>(
    '/analyze',
    {
      schema: {
        body: {
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string' },
            audioUrl: { type: 'string' },
            context: {
              type: 'object',
              properties: {
                location: {
                  type: 'object',
                  properties: {
                    latitude: { type: 'number' },
                    longitude: { type: 'number' },
                    cityId: { type: 'string' },
                  },
                },
                previousIntent: { type: 'string' },
                userId: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      try {
        const validated = analyzeTextSchema.parse(req.body);
        
        const analysis = await orchestratorService.analyzeText(
          req.server,
          validated as AnalyzeTextInput,
          req.user.globalUserId || req.user.id,
          req.tenant?.id
        );

        // Determinar se está pronto para execução
        const primaryIntent = analysis.intents[0];
        const executionReady = primaryIntent && primaryIntent.confidence >= 0.7;

        return {
          analysis,
          executionReady,
          suggestedExecution: executionReady
            ? {
                intent: primaryIntent.intent,
                parameters: primaryIntent.parameters || {},
                userId: req.user.globalUserId || req.user.id,
                tenantId: req.tenant?.id || '',
              }
            : undefined,
        };
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        fastify.log.error({ err: error }, 'Erro ao analisar texto');
        return reply.status(500).send({ error: 'Erro ao analisar texto' });
      }
    }
  );

  /**
   * POST /orchestrator/execute
   * Executa uma intent roteando para o módulo correto
   */
  fastify.post<{
    Body: {
      intent: string;
      parameters: Record<string, any>;
      targetModule?: string;
    };
  }>(
    '/execute',
    {
      schema: {
        body: {
          type: 'object',
          required: ['intent', 'parameters'],
          properties: {
            intent: { type: 'string' },
            parameters: { type: 'object' },
            targetModule: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const validated = executeIntentSchema.parse({
          ...req.body,
          userId: req.user.globalUserId || req.user.id,
          tenantId: req.tenant.id,
        });

        const result = await orchestratorService.execute(
          req.server,
          validated as ExecuteIntentInput
        );

        return result;
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        fastify.log.error({ err: error }, 'Erro ao executar intent');
        return reply.status(500).send({ error: 'Erro ao executar intent' });
      }
    }
  );
};

export default orchestratorRoutes;








