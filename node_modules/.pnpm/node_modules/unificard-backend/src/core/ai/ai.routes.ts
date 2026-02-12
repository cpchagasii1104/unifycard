// backend/src/core/ai/ai.routes.ts
import { FastifyPluginAsync } from 'fastify';
import type { ChatRequest, ChatResponse } from './ai.types';
import { memoryService } from './memory/memory.service';

const aiRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: ChatRequest }>('/chat', async (req, reply) => {
    if (!req.user || !req.tenant) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const { message, tab } = req.body;

    if (!message || !tab) {
      return reply.status(400).send({ error: 'message e tab são obrigatórios' });
    }

    const userId = req.user.id;
    const tenantId = req.tenant.id;
    const mode = tab;

    // Salvar mensagem do usuário
    memoryService.addMessage(userId, tenantId, mode, 'user', message);

    // Resposta MOCK fixa
    const assistantResponse = 'IA mock ativa. Mensagem recebida: ' + message + ' (tab: ' + tab + ')';

    // Salvar resposta do assistente
    memoryService.addMessage(userId, tenantId, mode, 'assistant', assistantResponse);

    // Obter histórico do modo atual
    const history = memoryService.getHistory(userId, tenantId, mode);

    const response: ChatResponse = {
      response: assistantResponse,
      history: history,
    };

    return reply.send(response);
  });
};

export default aiRoutes;

