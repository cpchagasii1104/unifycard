// src/core/dashboard/daily-metrics.routes.ts
// Rotas para dashboard de métricas diárias
import { FastifyPluginAsync } from 'fastify';
import { dailyMetricsService } from './daily-metrics.service';

const dailyMetricsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /dashboard/metrics/today
   * Retorna métricas do dia atual
   */
  fastify.get('/today', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }
    // 🔒 B4f: escopo OBRIGATÓRIO por tenant (server-side). Sem tenant, não há métrica (fail-closed).
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant context required' });
    }
    try {
      const metrics = await dailyMetricsService.getTodayMetrics(req.tenant.id);
      return metrics;
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar métricas do dia');
      return reply.status(500).send({ error: 'Erro ao buscar métricas' });
    }
  });

  /**
   * GET /dashboard/metrics/history?days=7
   * Retorna histórico de métricas
   */
  fastify.get<{
    Querystring: { days?: string };
  }>('/history', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }
    // 🔒 B4f: escopo OBRIGATÓRIO por tenant (server-side).
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant context required' });
    }
    try {
      const days = parseInt(req.query.days || '7', 10);
      const metrics = await dailyMetricsService.getMetricsHistory(req.tenant.id, days);
      return { metrics };
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar histórico de métricas');
      return reply.status(500).send({ error: 'Erro ao buscar histórico' });
    }
  });
};

export default dailyMetricsRoutes;


























