// src/core/instrumentation/types.ts

/**
 * Store de métricas em memória
 * Mantém estatísticas agregadas de requisições
 */
export interface MetricsStore {
  totalRequests: number;
  totalErrors: number;
  latencies: number[];
}

/**
 * Métricas calculadas a partir do store
 */
export interface CalculatedMetrics {
  totalRequests: number;
  totalErrors: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
}








