// backend/src/modules/marketplace/regional-fee.routes.ts
// SPRINT 83: TAXA REGIONAL + ECONOMIA COMUNITÁRIA

import type { FastifyInstance } from 'fastify';
import { regionalFeeService } from './regional-fee.service';

const regionalFeeRoutes = async (fastify: FastifyInstance) => {
  /**
   * GET /regions/:id/fees
   * Lista taxas regionais de uma região
   */
  fastify.get<{
    Params: { id: string };
    Querystring: {
      startDate?: string;
      endDate?: string;
    };
  }>('/regions/:id/fees', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const regionId = req.params.id;
    const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;

    const fees = await regionalFeeService.getFeesByRegion(tenantId, regionId, startDate, endDate);

    return reply.send({ fees });
  });

  /**
   * GET /regions/:id/fees/summary
   * Resume taxas regionais por período
   */
  fastify.get<{
    Params: { id: string };
    Querystring: {
      startDate?: string;
      endDate?: string;
    };
  }>('/regions/:id/fees/summary', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const regionId = req.params.id;
    const startDate = req.query.startDate
      ? new Date(req.query.startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 dias atrás
    const endDate = req.query.endDate
      ? new Date(req.query.endDate)
      : new Date();

    const summary = await regionalFeeService.summarizeByPeriod(
      tenantId,
      regionId,
      startDate,
      endDate
    );

    return reply.send({ summary });
  });
};

export default regionalFeeRoutes;
