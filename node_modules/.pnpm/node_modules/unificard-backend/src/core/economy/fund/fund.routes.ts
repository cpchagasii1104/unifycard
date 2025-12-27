// src/core/economy/fund/fund.routes.ts
// Rotas READ-ONLY para visibilidade do Fundo Regional

import { FastifyPluginAsync } from 'fastify';
import { fundVisibilityService } from './fund-visibility.service';
import fundDashboardRoutes from './fund-dashboard.routes';

interface HistoryQuery {
  days?: string;
}

const fundRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /fund/summary
   */
  fastify.get('/summary', async (req, reply) => {
    try {
      const tenantId = req.tenant!.id;
      const summary = await fundVisibilityService.getSummary(tenantId);
      return reply.send(summary);
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro desconhecido';
      fastify.log.error({ err: error, route: '/fund/summary' }, 'Erro ao buscar resumo do fundo');
      return reply.status(500).send({
        error: 'Erro ao buscar resumo do fundo regional',
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' ? { stack: error?.stack } : {}),
      });
    }
  });

  /**
   * GET /fund/history?days=30
   */
  fastify.get<{ Querystring: HistoryQuery }>('/history', async (req, reply) => {
    try {
      const tenantId = req.tenant!.id;
      const { days = '30' } = req.query;
      const rangeDays = parseInt(days, 10) || 30;
      const safeRangeDays = Math.min(Math.max(1, rangeDays), 365);

      const history = await fundVisibilityService.getHistory(tenantId, safeRangeDays);
      return reply.send(history);
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro desconhecido';
      fastify.log.error({ err: error, route: '/fund/history' }, 'Erro ao buscar histórico do fundo');
      return reply.status(500).send({
        error: 'Erro ao buscar histórico do fundo regional',
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' ? { stack: error?.stack } : {}),
      });
    }
  });

  /**
   * GET /fund/projection
   */
  fastify.get('/projection', async (req, reply) => {
    try {
      const tenantId = req.tenant!.id;
      const projection = await fundVisibilityService.getProjection(tenantId);
      return reply.send(projection);
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro desconhecido';
      fastify.log.error({ err: error, route: '/fund/projection' }, 'Erro ao buscar projeção do fundo');
      return reply.status(500).send({
        error: 'Erro ao buscar projeção do fundo regional',
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' ? { stack: error?.stack } : {}),
      });
    }
  });

  /**
   * GET /fund
   */
  fastify.get<{ Querystring: HistoryQuery }>('/', async (req, reply) => {
    try {
      const tenantId = req.tenant!.id;
      const { days = '30' } = req.query;
      const rangeDays = parseInt(days, 10) || 30;
      const safeRangeDays = Math.min(Math.max(1, rangeDays), 365);

      const view = await fundVisibilityService.getCompleteView(tenantId, safeRangeDays);
      return reply.send(view);
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro desconhecido';
      fastify.log.error({ err: error, route: '/fund' }, 'Erro ao buscar visão completa do fundo');
      return reply.status(500).send({
        error: 'Erro ao buscar dados do fundo regional',
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' ? { stack: error?.stack } : {}),
      });
    }
  });

  // Registrar rotas do dashboard
  await fastify.register(fundDashboardRoutes);
};

export default fundRoutes;
