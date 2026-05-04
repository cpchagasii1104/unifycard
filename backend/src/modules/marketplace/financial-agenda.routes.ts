// backend/src/modules/marketplace/financial-agenda.routes.ts
// SPRINT 85: AGENDA FINANCEIRA (CASHFLOW PROJETADO)

import type { FastifyInstance } from 'fastify';
import { financialAgendaService } from './financial-agenda.service';

const financialAgendaRoutes = async (fastify: FastifyInstance) => {
  /**
   * GET /finance/agenda
   * Busca agenda financeira
   */
  fastify.get<{
    Querystring: {
      startDate?: string;
      endDate?: string;
      types?: string;
      limit?: number;
      offset?: number;
    };
  }>('/finance/agenda', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
    const types = req.query.types
      ? (req.query.types as string).split(',') as any[]
      : undefined;
    const limit = req.query.limit;
    const offset = req.query.offset;

    const items = await financialAgendaService.getAgenda(tenantId, {
      startDate,
      endDate,
      types,
      limit,
      offset,
    });

    return reply.send({ items });
  });

  /**
   * GET /finance/cashflow
   * Calcula projeção de cashflow
   */
  fastify.get<{
    Querystring: {
      periodStart?: string;
      periodEnd?: string;
    };
  }>('/finance/cashflow', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const periodStart = req.query.periodStart
      ? new Date(req.query.periodStart)
      : new Date();
    const periodEnd = req.query.periodEnd
      ? new Date(req.query.periodEnd)
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 dias

    const projection = await financialAgendaService.getCashflowProjection(
      tenantId,
      periodStart,
      periodEnd
    );

    return reply.send({ projection });
  });
};

export default financialAgendaRoutes;
