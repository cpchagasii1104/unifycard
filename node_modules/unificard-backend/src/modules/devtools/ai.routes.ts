// src/modules/devtools/ai.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const runAISchema = z.object({
  prompt: z.string().min(1, 'Prompt é obrigatório'),
  payload: z.any().optional(),
});

const aiRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /dev/ai/run
   * Executa um prompt através do AI Kernel
   */
  fastify.post<{
    Body: {
      prompt: string;
      payload?: any;
    };
  }>(
    '/run',
    {
      schema: {
        body: {
          type: 'object',
          required: ['prompt'],
          properties: {
            prompt: { type: 'string' },
            payload: {},
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              output: { type: 'string' },
              reasoning: { type: 'array', items: { type: 'string' } },
              contextUsed: { type: 'object' },
            },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        // Validar body
        const validated = runAISchema.parse(req.body);
        const { prompt, payload } = validated;

        // Obter tenantId se disponível
        const tenantId = req.tenant?.id;

        // Executar através do AI Kernel
        const result = await fastify.ai.run(prompt, payload, tenantId);

        if (!result.success) {
          return reply.status(500).send({
            error: result.error || 'Erro ao executar prompt',
            output: '',
            reasoning: [],
            contextUsed: null,
          });
        }

        // Formatar resposta
        return reply.send({
          output: result.result || '',
          reasoning: result.thought?.reasoning || [],
          contextUsed: result.thought?.context || null,
        });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao processar rota AI');
        
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validação falhou',
            details: error.errors,
            output: '',
            reasoning: [],
            contextUsed: null,
          });
        }

        return reply.status(500).send({
          error: error instanceof Error ? error.message : 'Erro desconhecido',
          output: '',
          reasoning: [],
          contextUsed: null,
        });
      }
    }
  );
};

export default aiRoutes;

