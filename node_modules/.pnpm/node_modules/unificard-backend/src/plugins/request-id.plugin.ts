// backend/src/plugins/request-id.plugin.ts
// Plugin para adicionar requestId e correlationId a todas as requisições
// 🔴 BLINDAGEM: Observabilidade completa

import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
    correlationId: string;
  }
}

/**
 * Request ID Plugin
 * 
 * Adiciona requestId único e correlationId a todas as requisições
 * para rastreabilidade completa
 */
const requestIdPluginImpl: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    // Gerar requestId único se não existir
    const requestId = (request.headers['x-request-id'] as string) || randomUUID();
    
    // Usar correlationId do header ou gerar novo
    const correlationId = (request.headers['x-correlation-id'] as string) || requestId;

    // Adicionar ao request
    (request as any).requestId = requestId;
    (request as any).correlationId = correlationId;

    // Adicionar aos headers de resposta
    request.headers['x-request-id'] = requestId;
    request.headers['x-correlation-id'] = correlationId;
  });

  fastify.addHook('onSend', async (request, reply) => {
    // Garantir que headers estão na resposta
    const requestId = (request as any).requestId;
    const correlationId = (request as any).correlationId;
    
    if (requestId) {
      reply.header('x-request-id', requestId);
    }
    if (correlationId) {
      reply.header('x-correlation-id', correlationId);
    }
  });
};

export const requestIdPlugin = fp(requestIdPluginImpl, {
  name: 'request-id-plugin',
});



