// src/core/instrumentation/instrumentation.plugin.ts
//
// Plugin global de instrumentação do Unificard
// - Gera requestId único para cada requisição
// - Cria logger filho com contexto (requestId, tenantId, userId)
// - Mede latência de requisições
// - Coleta métricas básicas (total requests, erros, latências)

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import type { MetricsStore, CalculatedMetrics } from './types';

// Store de métricas em memória
const metricsStore: MetricsStore = {
  totalRequests: 0,
  totalErrors: 0,
  latencies: [],
};

// Limite de latências armazenadas (para evitar consumo excessivo de memória)
const MAX_LATENCIES = 10000;

/**
 * Calcula métricas a partir do store
 */
function calculateMetrics(): CalculatedMetrics {
  const latencies = metricsStore.latencies;
  
  if (latencies.length === 0) {
    return {
      totalRequests: metricsStore.totalRequests,
      totalErrors: metricsStore.totalErrors,
      averageLatency: 0,
      maxLatency: 0,
      minLatency: 0,
    };
  }

  const sum = latencies.reduce((acc, val) => acc + val, 0);
  const average = sum / latencies.length;
  const max = Math.max(...latencies);
  const min = Math.min(...latencies);

  return {
    totalRequests: metricsStore.totalRequests,
    totalErrors: metricsStore.totalErrors,
    averageLatency: Math.round(average * 100) / 100, // 2 casas decimais
    maxLatency: Math.round(max * 100) / 100,
    minLatency: Math.round(min * 100) / 100,
  };
}

/**
 * Adiciona latência ao store (com limite de tamanho)
 */
function addLatency(latency: number): void {
  metricsStore.latencies.push(latency);
  
  // Manter apenas as últimas MAX_LATENCIES latências
  if (metricsStore.latencies.length > MAX_LATENCIES) {
    metricsStore.latencies.shift();
  }
}

const instrumentationPlugin: FastifyPluginAsync = async (fastify) => {
  // Hook: onRequest - Executado no início de cada requisição
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // 1. Gerar ou usar requestId existente
    const requestId = (request.headers['x-request-id'] as string) || uuidv4();
    
    // 2. Salvar requestId no request
    (request as any).requestId = requestId;
    
    // 3. Extrair contexto (tenantId e userId podem não estar disponíveis ainda)
    const reqAny = request as any;
    const tenantId = reqAny.tenant?.id || null;
    const userId = reqAny.user?.id || null;
    
    // 4. Criar logger filho com contexto
    const childLogger = fastify.log.child({
      requestId,
      tenantId: tenantId || undefined,
      userId: userId || undefined,
    });
    
    // 5. Substituir req.log pelo logger filho
    (request as any).log = childLogger;
    
    // 6. Marcar início da requisição
    const startTime = Date.now();
    (request as any).startTime = startTime;
    
    // 7. Incrementar contador de requisições
    metricsStore.totalRequests++;
    
    // 8. Logar início da requisição
    childLogger.info({
      method: request.method,
      url: request.url,
    }, 'Request started');
  });

  // Hook: onResponse - Executado no fim de cada requisição
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = (request as any).requestId;
    const startTime = (request as any).startTime;
    const childLogger = (request as any).log || fastify.log;
    
    if (startTime) {
      // Calcular latência em milissegundos
      const latency = Date.now() - startTime;
      
      // Adicionar latência ao store
      addLatency(latency);
      
      // Logar fim da requisição
      childLogger.info({
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        latency: `${latency}ms`,
      }, 'Request completed');
    }
  });

  // Hook: onError - Executado quando há erro
  fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    const requestId = (request as any).requestId;
    const childLogger = (request as any).log || fastify.log;
    
    // Incrementar contador de erros
    metricsStore.totalErrors++;
    
    // Logar erro
    childLogger.error({
      err: error,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode || 500,
    }, 'Request error');
  });

  // Rota: GET /metrics - Retorna métricas básicas
  // Esta rota será registrada no escopo público do servidor
  // (não aqui, mas exposta via decorator para uso externo)

  // Expor store para uso interno (se necessário)
  fastify.decorate('metricsStore', metricsStore);
  fastify.decorate('calculateMetrics', calculateMetrics);
};

export default instrumentationPlugin;

