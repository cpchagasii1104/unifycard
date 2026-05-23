// INFRA-6: métricas e hints de alerta para camada 2 (handler failures) — sem alterar pipeline.

import { FastifyPluginAsync } from 'fastify';
import { handlerMetricsService } from './handler-metrics.service';

const handlerMetricsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/summary', async (_req, reply) => {
    try {
      return reply.status(200).send({
        success: true,
        metrics: handlerMetricsService.getJsonDashboard(),
      });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'handler metrics summary');
      return reply.status(500).send({ error: err.message || 'Failed' });
    }
  });

  fastify.get('/prometheus', async (_req, reply) => {
    try {
      const body = handlerMetricsService.getPrometheusExposition();
      return reply.status(200).header('content-type', 'text/plain; version=0.0.4').send(body || '# no handler metric samples yet\n');
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'handler metrics prometheus');
      return reply.status(500).send({ error: err.message || 'Failed' });
    }
  });

  fastify.get('/snapshot', async (_req, reply) => {
    try {
      const db = await handlerMetricsService.fetchDbSnapshot();
      return reply.status(200).send({ success: true, db });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'handler metrics snapshot');
      return reply.status(500).send({ error: err.message || 'Failed' });
    }
  });

  fastify.get('/alert-hints', async (_req, reply) => {
    try {
      const hints = await handlerMetricsService.evaluateAlertHints();
      return reply.status(200).send({ success: true, ...hints });
    } catch (error) {
      const err = error as Error;
      fastify.log.error({ err: error }, 'handler metrics alert hints');
      return reply.status(500).send({ error: err.message || 'Failed' });
    }
  });
};

export default handlerMetricsRoutes;