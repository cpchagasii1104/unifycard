// INFRA-6 GLOBAL — rotas só leitura (métricas outbox + referência handlers).

import { FastifyPluginAsync } from 'fastify';
import { outboxMetricsService } from './outbox-metrics.service';

const outboxMetricsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/summary', async (_req, reply) => {
    try {
      const consolidated = await outboxMetricsService.getConsolidated();
      return reply.status(200).send({
        success: true,
        consolidated,
      });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'outbox metrics summary');
      return reply.status(500).send({ error: err.message || 'Failed' });
    }
  });

  fastify.get('/prometheus', async (_req, reply) => {
    try {
      const consolidated = await outboxMetricsService.getConsolidated();
      const body = outboxMetricsService.getPrometheusText(consolidated);
      return reply.status(200).header('content-type', 'text/plain; version=0.0.4').send(body);
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'outbox metrics prometheus');
      return reply.status(500).send({ error: err.message || 'Failed' });
    }
  });

  fastify.get('/alert-hints', async (_req, reply) => {
    try {
      const hints = await outboxMetricsService.evaluateOutboxAlertHints();
      return reply.status(200).send({ success: true, ...hints });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'outbox metrics alert hints');
      return reply.status(500).send({ error: err.message || 'Failed' });
    }
  });
};

export default outboxMetricsRoutes;