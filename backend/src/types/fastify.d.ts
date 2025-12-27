// src/types/fastify.d.ts
import 'fastify';
import { AIKernel } from '../core/ai/ai-kernel';

declare module 'fastify' {
  interface FastifyInstance {
    ai: AIKernel;
  }
}
import 'fastify';
import type { MetricsStore } from '../core/instrumentation/types';

declare module 'fastify' {
  interface FastifyRequest {
    tenant: { id: string } | null;
    user: { id: string; email?: string; globalUserId?: string } | null;
    userPermissions?: string[];
    userRoles?: string[];
    requestId?: string;
    startTime?: number;
  }

  interface FastifyInstance {
    metricsStore?: MetricsStore;
    calculateMetrics?: () => import('../core/instrumentation/types').CalculatedMetrics;
  }
}
