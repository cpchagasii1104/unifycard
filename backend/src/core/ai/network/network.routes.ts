// backend/src/core/ai/network/network.routes.ts
import { FastifyPluginAsync } from 'fastify';
import type { NetworkFetchRequest, NetworkFetchResponse } from './network.types';
import { networkService } from './network.service';

const networkRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: NetworkFetchRequest }>('/fetch', async (req, reply) => {
    if (!req.user || !req.tenant) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return reply.status(400).send({ error: 'url é obrigatório e deve ser uma string' });
    }

    try {
      const response: NetworkFetchResponse = await networkService.fetch(url);

      return reply.send(response);
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Erro ao fazer requisição HTTP');

      if (error.message.includes('não está habilitado')) {
        return reply.status(403).send({ error: error.message });
      }

      if (error.message.includes('não está na whitelist') || error.message.includes('não permitido')) {
        return reply.status(403).send({ error: error.message });
      }

      if (error.message.includes('Timeout')) {
        return reply.status(408).send({ error: error.message });
      }

      if (error.message.includes('URL inválida')) {
        return reply.status(400).send({ error: error.message });
      }

      return reply.status(500).send({ error: 'Erro ao fazer requisição HTTP' });
    }
  });
};

export default networkRoutes;


