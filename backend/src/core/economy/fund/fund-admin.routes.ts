// src/core/economy/fund/fund-admin.routes.ts
// Rotas internas para painel de observação do fundo (admin/dev)

import { FastifyPluginAsync } from 'fastify';
import { fundAdminService } from './fund-admin.service';
import { fundWeeklyReportService } from './fund-weekly-report.service';

const fundAdminRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /fund/admin/regions
   * Lista todas as regiões com dados agregados do fundo
   * Requer permissão: economy:accounts:read (admin)
   */
  fastify.get('/regions', {
    preHandler: [fastify.requirePermission(['economy:accounts:read'])],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const regions = await fundAdminService.listAllRegions(tenantId);
    return reply.send({ regions });
  });

  /**
   * GET /fund/admin/export?format=csv|json
   * Exporta dados do fundo por região
   * Requer permissão: economy:accounts:read (admin)
   */
  fastify.get<{ Querystring: { format?: 'csv' | 'json' } }>('/export', {
    preHandler: [fastify.requirePermission(['economy:accounts:read'])],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const { format = 'json' } = req.query;

    const data = await fundAdminService.exportRegionsData(tenantId);

    if (format === 'csv') {
      // Gerar CSV
      const headers = [
        'regionId',
        'regionName',
        'balance',
        'totalAccumulated',
        'transactionCount',
        'growth7Days',
        'growth30Days',
        'lastTransactionDate',
        'exportDate',
      ];

      const csvRows = [
        headers.join(','),
        ...data.map((row) =>
          [
            row.regionId,
            row.regionName || '',
            row.balance.toFixed(2),
            row.totalAccumulated.toFixed(2),
            row.transactionCount,
            row.growth7Days.toFixed(2),
            row.growth30Days.toFixed(2),
            row.lastTransactionDate || '',
            row.exportDate,
          ].join(',')
        ),
      ];

      const csv = csvRows.join('\n');

      reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', `attachment; filename="fund-regions-${new Date().toISOString().split('T')[0]}.csv"`)
        .send(csv);
    } else {
      // JSON
      reply
        .header('Content-Type', 'application/json')
        .header('Content-Disposition', `attachment; filename="fund-regions-${new Date().toISOString().split('T')[0]}.json"`)
        .send(data);
    }
  });

  /**
   * GET /fund/admin/weekly-report
   * Retorna relatório semanal mais recente
   * Requer permissão: economy:accounts:read (admin)
   */
  fastify.get('/weekly-report', {
    preHandler: [fastify.requirePermission(['economy:accounts:read'])],
  }, async (req, reply) => {
    const tenantId = req.tenant!.id;
    const report = await fundWeeklyReportService.getLatestReport(tenantId);

    if (!report) {
      return reply.status(404).send({
        error: 'Nenhum relatório semanal encontrado',
        message: 'O relatório será gerado automaticamente uma vez por semana',
      });
    }

    return reply.send(report);
  });
};

export default fundAdminRoutes;

