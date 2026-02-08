// src/modules/groups/groups-closure.routes.ts
// Rotas de fechamento de grupos (read-only)
// 🔴 BLINDAGEM: Apenas leitura, não altera estado
// 🔴 BLINDAGEM: Usa apenas dados históricos reais
// 🔴 BLINDAGEM: Nenhuma comparação, nenhuma avaliação, nenhuma projeção futura

import { FastifyPluginAsync } from 'fastify';
import { runQueryWithTenant } from '@core/database/pool';

const groupsClosureRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /groups/:groupId/closure-summary
   * Resumo de fechamento do grupo (read-only)
   * 🔴 BLINDAGEM: Apenas leitura, não altera estado
   * 🔴 BLINDAGEM: Usa apenas dados históricos reais
   */
  fastify.get<{
    Params: { groupId: string };
  }>(
    '/:groupId/closure-summary',
    {
      preHandler: fastify.requirePermission(['groups:read']),
    },
    async (req, reply) => {
      const tenantId = req.tenant!.id;
      const { groupId } = req.params;

      try {
        // Verificar se grupo existe
        const groupRow = await runQueryWithTenant<{
          group_id: string;
          createdAt: Date;
        }>(
          tenantId,
          `SELECT group_id, createdAt FROM groups WHERE group_id = $1 AND tenant_id = $2`,
          [groupId, tenantId]
        );

        if (!groupRow) {
          return reply.status(404).send({ error: 'Grupo não encontrado' });
        }

        // Contar eventos do grupo (via group_events)
        const lifetimeEventsRow = await runQueryWithTenant<{ count: string }>(
          tenantId,
          `SELECT COUNT(*) as count FROM group_events WHERE group_id = $1`,
          [groupId]
        );
        const lifetimeEvents = lifetimeEventsRow ? Number(lifetimeEventsRow.count) : 0;

        // Volume econômico total (soma de execuções e splits onde grupo é receiver)
        const lifetimeEconomicVolumeRow = await runQueryWithTenant<{ totalCents: string }>(
          tenantId,
          `
          SELECT COALESCE(
            (
              SELECT COALESCE(SUM(amount), 0)
              FROM service_payment_executions
              WHERE receiver_actor_id = $1 AND tenant_id = $2
            ) +
            (
              SELECT COALESCE(SUM(ps.amount), 0)
              FROM payment_splits ps
              INNER JOIN service_payment_executions spe ON ps.execution_id = spe.execution_id
              WHERE ps.receiver_actor_id = $1 AND ps.tenant_id = $2
            ),
            0
          )::text as total
          `,
          [groupId, tenantId]
        );
        const lifetimeEconomicVolume = lifetimeEconomicVolumeRow ? Number(lifetimeEconomicVolumeRow.total) : 0;

        return reply.send({
          lifetimeEvents,
          lifetimeEconomicVolume,
          createdAt: groupRow.createdAt.toISOString(),
        });
      } catch (error) {
        req.log.error({ err: error, groupId }, 'Erro ao buscar resumo de fechamento do grupo');
        const err = error as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 500).send({ error: err.message });
      }
    }
  );
};

export default groupsClosureRoutes;



