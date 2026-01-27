// backend/src/core/ai/strategy/strategy.routes.ts
import { FastifyPluginAsync } from 'fastify';
import type { StrategyRequest, StrategyResponse } from './strategy.types';
import { memoryService } from '../memory/memory.service';
import { createLLMAdapter } from '../llm/llm.adapter';

const strategyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: StrategyRequest }>('/strategy', async (req, reply) => {
    if (!req.user || !req.tenant) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const { message, mode } = req.body;

    if (!message || !mode) {
      return reply.status(400).send({ error: 'message e mode são obrigatórios' });
    }

    const userId = req.user.id;
    const tenantId = req.tenant.id;

    // Ler histórico do modo atual (apenas contexto, não altera)
    const history = memoryService.getHistory(userId, tenantId, mode);

    try {
      // Usar adapter de LLM (OpenAI ou Mock)
      const llmAdapter = createLLMAdapter();
      const response: StrategyResponse = await llmAdapter.generateStrategy(message, mode, history);

      return reply.send(response);
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao gerar estratégia');
      
      // Fallback para resposta mock em caso de erro
      const mockAdapter = createLLMAdapter();
      const fallbackResponse: StrategyResponse = await mockAdapter.generateStrategy(message, mode, history);
      
      return reply.send(fallbackResponse);
    }
  });
};

export default strategyRoutes;

